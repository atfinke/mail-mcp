import AppKit
import Foundation
import OSLog

enum JSONResponseError: Codable {
    case payload(JSONError)

    func encoded() -> Data? {
        switch self {
        case .payload(let payload):
            return try? JSONEncoder.pretty.encode(payload)
        }
    }
}

struct JSONError: Codable {
    let error: String
}

enum HelperError: Error {
    case message(String)
}

struct Invocation {
    let requestPath: String
    let responsePath: String?
}

@main
@MainActor
struct MailMCPHelperAppMain {
    static let logger = Logger(subsystem: "com.andrewfinke.mailmcphelper", category: "helper")

    static func main() async {
        let rawArguments = sanitizedArguments()
        let fallbackResponsePath = responsePathFromRawArguments(rawArguments)

        do {
            initializeAppKit()

            if shouldRunInteractiveBootstrap(rawArguments) {
                let exitCode = await runInteractiveBootstrap()
                NSApp.terminate(nil)
                exit(exitCode)
            }

            let invocation = try parseInvocation(rawArguments)
            let request = try loadRequest(from: invocation.requestPath)
            let data = try MailAutomationRunner.run(request: request)
            try writeResponse(data, responsePath: invocation.responsePath)
            NSApp.terminate(nil)
            exit(0)
        } catch {
            logger.error("Helper request failed: \(errorMessage(error), privacy: .public)")

            if let data = JSONResponseError.payload(JSONError(error: errorMessage(error))).encoded() {
                try? writeResponse(data, responsePath: fallbackResponsePath)
            }

            NSApp.terminate(nil)
            exit(1)
        }
    }

    static func initializeAppKit() {
        _ = NSApplication.shared
        NSApp.setActivationPolicy(.accessory)
    }

    static func sanitizedArguments() -> [String] {
        let rawArguments = Array(CommandLine.arguments.dropFirst())
        var sanitized: [String] = []
        var index = 0

        while index < rawArguments.count {
            let token = rawArguments[index]

            if token.hasPrefix("-psn_") {
                index += 1
                continue
            }

            if token == "-ApplePersistenceIgnoreState" {
                index += min(2, rawArguments.count - index)
                continue
            }

            sanitized.append(token)
            index += 1
        }

        return sanitized
    }

    static func responsePathFromRawArguments(_ rawArguments: [String]) -> String? {
        var index = 0

        while index < rawArguments.count {
            if rawArguments[index] == "--response-path" {
                let nextIndex = index + 1
                if nextIndex < rawArguments.count, !rawArguments[nextIndex].hasPrefix("--") {
                    return rawArguments[nextIndex]
                }
            }

            index += 1
        }

        return nil
    }

    static func shouldRunInteractiveBootstrap(_ rawArguments: [String]) -> Bool {
        !rawArguments.contains("--request-path")
    }

    static func parseInvocation(_ rawArguments: [String]) throws -> Invocation {
        var options = try parseOptions(rawArguments)
        guard let requestPath = options.removeValue(forKey: "request-path"), !requestPath.isEmpty else {
            throw HelperError.message("Missing --request-path for Mail helper invocation.")
        }

        let responsePath = options.removeValue(forKey: "response-path")
        return Invocation(requestPath: requestPath, responsePath: responsePath)
    }

    static func parseOptions(_ args: [String]) throws -> [String: String] {
        var options: [String: String] = [:]
        var index = 0

        while index < args.count {
            let token = args[index]
            guard token.hasPrefix("--") else {
                throw HelperError.message("Unexpected token: \(token)")
            }

            let key = String(token.dropFirst(2))
            let nextIndex = index + 1

            if nextIndex < args.count, !args[nextIndex].hasPrefix("--") {
                options[key] = args[nextIndex]
                index += 2
            } else {
                options[key] = "true"
                index += 1
            }
        }

        return options
    }

    static func loadRequest(from requestPath: String) throws -> HelperRequest {
        let data = try Data(contentsOf: URL(fileURLWithPath: requestPath))

        let request: HelperRequest
        do {
            request = try JSONDecoder().decode(HelperRequest.self, from: data)
        } catch {
            throw HelperError.message("Unable to decode helper request JSON: \(error.localizedDescription)")
        }

        try request.validate()
        return request
    }

    static func writeResponse(_ data: Data, responsePath: String?) throws {
        guard let responsePath, !responsePath.isEmpty else {
            FileHandle.standardOutput.write(data)
            FileHandle.standardOutput.write(Data("\n".utf8))
            return
        }

        let responseURL = URL(fileURLWithPath: responsePath)
        try FileManager.default.createDirectory(
            at: responseURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try data.write(to: responseURL, options: .atomic)
    }

    static func runInteractiveBootstrap() async -> Int32 {
        prepareForInteractiveLaunch()

        do {
            let request = HelperRequest(action: .probe)
            let result = try MailAutomationRunner.run(request: request)
            let access = try JSONDecoder().decode(MailAccessPayload.self, from: result)
            presentBootstrapAlert(access: access)
            return access.accessible ? 0 : 1
        } catch {
            presentAlert(
                title: "Mail Access Failed",
                message: """
                The helper app could not access Mail.

                \(errorMessage(error))

                If macOS did not show a prompt, relaunch MailMCPHelperApp directly from Finder and try again.
                """
            )
            return 1
        }
    }

    static func prepareForInteractiveLaunch() {
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
    }

    static func presentBootstrapAlert(access: MailAccessPayload) {
        if access.accessible {
            presentAlert(
                title: "Mail Access Ready",
                message: """
                MailMCPHelperApp can control Mail.

                Return to Codex and use `mail_check_access`, `mail_list_accounts`, or `mail_list_inbox_messages`.
                """
            )
            return
        }

        let message = access.error ?? "Mail automation access is not available yet."
        presentAlert(
            title: "Mail Access Not Ready",
            message: """
            \(message)

            If macOS did not show a prompt, relaunch MailMCPHelperApp directly from Finder and try again.
            """
        )
    }

    static func presentAlert(title: String, message: String) {
        NSApp.activate(ignoringOtherApps: true)

        let alert = NSAlert()
        alert.alertStyle = .informational
        alert.messageText = title
        alert.informativeText = message
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }

    static func errorMessage(_ error: Error) -> String {
        if let helperError = error as? HelperError {
            switch helperError {
            case .message(let message):
                return message
            }
        }

        if let localized = error as? LocalizedError, let description = localized.errorDescription {
            return description
        }

        return String(describing: error)
    }
}

extension JSONEncoder {
    static var pretty: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return encoder
    }
}
