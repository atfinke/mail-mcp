import Foundation
import OSAKit
import OSLog

struct MailRecipientInput: Codable {
    let address: String
    let name: String?
}

enum HelperAction: String, Codable {
    case probe
    case listAccounts
    case listMailboxes
    case listMessagesForMailbox
    case listInboxMessages
    case getMessage
    case composeMessage
    case replyToMessage
    case forwardMessage
    case moveMessage
}

struct HelperRequest: Codable {
    let action: HelperAction
    let accountId: String?
    let accountIds: [String]?
    let mailboxPathSegments: [String]?
    let destinationMailboxPathSegments: [String]?
    let unreadOnly: Bool?
    let since: String?
    let limit: Int?
    let limitPerInbox: Int?
    let includeHeaders: Bool?
    let messageId: Int?
    let replyAll: Bool?
    let sender: String?
    let subject: String?
    let body: String?
    let toRecipients: [MailRecipientInput]?
    let ccRecipients: [MailRecipientInput]?
    let bccRecipients: [MailRecipientInput]?

    init(
        action: HelperAction,
        accountId: String? = nil,
        accountIds: [String]? = nil,
        mailboxPathSegments: [String]? = nil,
        destinationMailboxPathSegments: [String]? = nil,
        unreadOnly: Bool? = nil,
        since: String? = nil,
        limit: Int? = nil,
        limitPerInbox: Int? = nil,
        includeHeaders: Bool? = nil,
        messageId: Int? = nil,
        replyAll: Bool? = nil,
        sender: String? = nil,
        subject: String? = nil,
        body: String? = nil,
        toRecipients: [MailRecipientInput]? = nil,
        ccRecipients: [MailRecipientInput]? = nil,
        bccRecipients: [MailRecipientInput]? = nil
    ) {
        self.action = action
        self.accountId = accountId
        self.accountIds = accountIds
        self.mailboxPathSegments = mailboxPathSegments
        self.destinationMailboxPathSegments = destinationMailboxPathSegments
        self.unreadOnly = unreadOnly
        self.since = since
        self.limit = limit
        self.limitPerInbox = limitPerInbox
        self.includeHeaders = includeHeaders
        self.messageId = messageId
        self.replyAll = replyAll
        self.sender = sender
        self.subject = subject
        self.body = body
        self.toRecipients = toRecipients
        self.ccRecipients = ccRecipients
        self.bccRecipients = bccRecipients
    }

    func validate() throws {
        switch action {
        case .moveMessage:
            guard let destinationMailboxPathSegments else {
                throw HelperError.message("Missing destination mailbox path for moveMessage.")
            }

            if isBlockedMoveDestinationMailboxPath(destinationMailboxPathSegments) {
                throw HelperError.message("Moving messages to Trash or deleted mailboxes is not allowed.")
            }
        default:
            break
        }
    }
}

private func normalizeMailboxName(_ name: String) -> String {
    name.trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
        .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
}

private let blockedMoveDestinationMailboxNames = Set([
    "trash",
    "deleted",
    "deleted items",
    "deleted messages",
])

private func isBlockedMoveDestinationMailboxPath(_ pathSegments: [String]) -> Bool {
    pathSegments.contains { blockedMoveDestinationMailboxNames.contains(normalizeMailboxName($0)) }
}

struct MailAccessPayload: Codable {
    let accessible: Bool
    let count: Int
    let error: String?
}

struct MailRecipientPayload: Codable {
    let name: String?
    let address: String?
}

struct MailHeaderPayload: Codable {
    let name: String
    let content: String
}

struct MailAttachmentPayload: Codable {
    let name: String?
    let mimeType: String?
}

struct MailAccountPayload: Codable {
    let id: String
    let name: String
    let emailAddresses: [String]
    let enabled: Bool
}

struct MailMailboxPayload: Codable {
    let accountId: String
    let accountName: String
    let name: String
    let path: String
    let pathSegments: [String]
    let unreadCount: Int
    let messageCount: Int
    let childCount: Int
    let isInbox: Bool
}

struct MailMessagePayload: Codable {
    let id: Int
    let accountId: String
    let accountName: String
    let mailboxName: String
    let mailboxPath: String
    let mailboxPathSegments: [String]
    let subject: String
    let sender: String?
    let dateReceived: String?
    let dateSent: String?
    let read: Bool
    let flagged: Bool
    let deleted: Bool
    let toRecipients: [MailRecipientPayload]
    let ccRecipients: [MailRecipientPayload]
    let bccRecipients: [MailRecipientPayload]
    let content: String
    let headers: [MailHeaderPayload]
    let attachments: [MailAttachmentPayload]
}

enum MailDraftKind: String, Codable {
    case compose
    case reply
    case forward
}

struct MailDraftPayload: Codable {
    let id: Int
    let kind: MailDraftKind
    let visible: Bool
    let sender: String?
    let subject: String
    let toRecipients: [MailRecipientPayload]
    let ccRecipients: [MailRecipientPayload]
    let bccRecipients: [MailRecipientPayload]
    let content: String
}

struct MailAccountsResultPayload: Codable {
    let items: [MailAccountPayload]
}

struct MailMailboxesResultPayload: Codable {
    let items: [MailMailboxPayload]
}

struct MailMessagesResultPayload: Codable {
    let items: [MailMessagePayload]
}

struct MailMessageResultPayload: Codable {
    let message: MailMessagePayload?
}

struct MailDraftResultPayload: Codable {
    let draft: MailDraftPayload
}

struct MailMovePayload: Codable {
    let moved: Bool
    let accountId: String
    let messageId: Int
    let sourceMailboxPath: String
    let sourceMailboxPathSegments: [String]
    let destinationMailboxPath: String
    let destinationMailboxPathSegments: [String]
}

struct MailMoveResultPayload: Codable {
    let move: MailMovePayload
}

enum MailAutomationRunner {
    static let logger = Logger(subsystem: "com.andrewfinke.mailmcphelper", category: "automation")

    static func run(request: HelperRequest) throws -> Data {
        try request.validate()

        let source = try loadScriptSource()
        guard let language = OSALanguage(forName: "JavaScript") else {
            throw HelperError.message("JavaScript for Automation is not available on this Mac.")
        }

        let script = OSAScript(source: source, language: language)
        var compileError: NSDictionary?
        guard script.compileAndReturnError(&compileError) else {
            throw HelperError.message(formatScriptError(compileError) ?? "Unable to compile helper automation script.")
        }

        let requestData = try JSONEncoder.pretty.encode(request)
        guard let requestString = String(data: requestData, encoding: .utf8) else {
            throw HelperError.message("Unable to encode helper request JSON.")
        }

        logger.info("Executing helper action \(request.action.rawValue, privacy: .public)")

        var executeError: NSDictionary?
        let result = script.executeHandler(withName: "runAction", arguments: [requestString], error: &executeError)
        if let executeError {
            throw HelperError.message(formatScriptError(executeError) ?? "Mail automation execution failed.")
        }

        guard let output = result?.stringValue else {
            throw HelperError.message("Mail automation returned no JSON output.")
        }

        return Data(output.utf8)
    }

    private static func loadScriptSource() throws -> String {
        guard let url = Bundle.main.url(forResource: "MailAutomation", withExtension: "js") else {
            throw HelperError.message("Missing bundled MailAutomation.js resource.")
        }

        do {
            return try String(contentsOf: url, encoding: .utf8)
        } catch {
            throw HelperError.message("Unable to load MailAutomation.js: \(error.localizedDescription)")
        }
    }

    private static func formatScriptError(_ errorInfo: NSDictionary?) -> String? {
        guard let errorInfo else {
            return nil
        }

        if let message = errorInfo[OSAScriptErrorMessageKey] as? String, !message.isEmpty {
            if let number = errorInfo[OSAScriptErrorNumberKey] {
                return "\(message) (error \(number))"
            }

            return message
        }

        if let brief = errorInfo[OSAScriptErrorBriefMessageKey] as? String, !brief.isEmpty {
            return brief
        }

        return errorInfo.description
    }
}
