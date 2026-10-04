import Foundation
import PDFKit

let input = CommandLine.arguments[1]
let host = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: input))) as! [String: Any]
var results: [[String: Any]] = []
for item in host["fixtures"] as! [[String: Any]] {
    let document = PDFDocument(url: URL(fileURLWithPath: item["pdf"] as! String))!
    var searches: [String: Any] = [:]
    for needle in ["工作方向页面长", "⼯⽅⻚⾯⻓", "English"] {
        let matches = document.findString(needle, withOptions: [])
        searches[needle] = ["matches": matches.count, "exactSelection": !matches.isEmpty && matches.allSatisfy { $0.string == needle }]
    }
    results.append(["name": item["name"]!, "pages": (0..<document.pageCount).map { document.page(at: $0)?.string ?? "" }, "searches": searches])
}
let data = try JSONSerialization.data(withJSONObject: results, options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes])
print(String(data: data, encoding: .utf8)!)
