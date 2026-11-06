import Foundation
import CoreGraphics
import CoreText
import ImageIO
import UniformTypeIdentifiers

// BRAND-SIGNATURE-B-001. macOS-only exporter; no app dependency or external service.
let repo = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let root = repo.appendingPathComponent("assets/brand/signature-b")
let fm = FileManager.default
let ink = "#1A3329", leaf = "#7CB518", mint = "#F4FBF6", muted = "#5B7A6A"
let fontURL = repo.appendingPathComponent("node_modules/@expo-google-fonts/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf")
guard let fontProvider = CGDataProvider(url: fontURL as CFURL), let cgFont = CGFont(fontProvider) else {
    fatalError("Plus Jakarta Sans Bold introuvable. Installer les dépendances existantes du dépôt.")
}

struct Shape { let path: CGPath; let fill: String?; let stroke: String?; let width: CGFloat }
struct Scene { let width: Int; let height: Int; let shapes: [Shape]; let opaque: Bool }
var manifest: [[String: Any]] = []
func rect(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ color: String) -> Shape {
    Shape(path: CGPath(rect: CGRect(x: x, y: y, width: w, height: h), transform: nil), fill: color, stroke: nil, width: 0)
}
func symbol(_ base: String, _ accent: String, x: CGFloat = 0, y: CGFloat = 0, size: CGFloat = 32) -> [Shape] {
    // Exact geometry of proposal-b-active.svg selected by the user.
    let p = CGMutablePath()
    p.move(to: CGPoint(x: 5,y: 26)); p.addLine(to: CGPoint(x: 5,y: 8)); p.addLine(to: CGPoint(x: 12,y: 15))
    p.move(to: CGPoint(x: 26,y: 19)); p.addLine(to: CGPoint(x: 26,y: 26))
    let a = CGMutablePath()
    a.move(to: CGPoint(x: 19,y: 21)); a.addCurve(to: CGPoint(x: 14,y: 25), control1: CGPoint(x: 23,y: 26), control2: CGPoint(x: 17,y: 29))
    a.addCurve(to: CGPoint(x: 17,y: 16), control1: CGPoint(x: 11,y: 22), control2: CGPoint(x: 14,y: 19))
    a.addLine(to: CGPoint(x: 26,y: 7)); a.move(to: CGPoint(x: 19,y: 7)); a.addLine(to: CGPoint(x: 26,y: 7)); a.addLine(to: CGPoint(x: 26,y: 14))
    var t = CGAffineTransform(a: size/32,b: 0,c: 0,d: size/32,tx: x,ty: y)
    return [Shape(path: p.copy(using: &t)!,fill: nil,stroke: base,width: 3.2*size/32), Shape(path: a.copy(using: &t)!,fill: nil,stroke: accent,width: 3.2*size/32)]
}
func word(_ value: String, size: CGFloat, x: CGFloat, baseline: CGFloat, color: String) -> [Shape] {
    let font = CTFontCreateWithGraphicsFont(cgFont, size, nil, nil)
    let attrs: [NSAttributedString.Key: Any] = [NSAttributedString.Key(kCTFontAttributeName as String): font]
    let line = CTLineCreateWithAttributedString(NSAttributedString(string: value, attributes: attrs))
    var output: [Shape] = []
    for run in CTLineGetGlyphRuns(line) as! [CTRun] {
        let n = CTRunGetGlyphCount(run)
        var glyphs = [CGGlyph](repeating: 0,count: n), positions = [CGPoint](repeating: .zero,count: n)
        CTRunGetGlyphs(run,CFRange(location: 0,length: n),&glyphs)
        CTRunGetPositions(run,CFRange(location: 0,length: n),&positions)
        for i in 0..<n {
            if let p = CTFontCreatePathForGlyph(font,glyphs[i],nil) {
                var t = CGAffineTransform(a: 1,b: 0,c: 0,d: -1,tx: x+positions[i].x,ty: baseline-positions[i].y)
                output.append(Shape(path: p.copy(using: &t)!,fill: color,stroke: nil,width: 0))
            }
        }
    }
    return output
}
func color(_ value: String) -> CGColor {
    let n = UInt32(value.dropFirst(),radix:16)!
    return CGColor(srgbRed: CGFloat((n>>16)&255)/255,green: CGFloat((n>>8)&255)/255,blue: CGFloat(n&255)/255,alpha:1)
}
func svgPath(_ path: CGPath) -> String {
    var s = ""
    func pt(_ p: CGPoint) -> String { String(format:"%.4f %.4f",Double(p.x),Double(p.y)) }
    path.applyWithBlock { ptr in
        let e = ptr.pointee
        switch e.type {
        case .moveToPoint: s += "M"+pt(e.points[0])
        case .addLineToPoint: s += "L"+pt(e.points[0])
        case .addQuadCurveToPoint: s += "Q"+pt(e.points[0])+" "+pt(e.points[1])
        case .addCurveToPoint: s += "C"+pt(e.points[0])+" "+pt(e.points[1])+" "+pt(e.points[2])
        case .closeSubpath: s += "Z"
        @unknown default: break
        }
    }
    return s
}
func target(_ path: String) throws -> URL {
    let u = root.appendingPathComponent(path)
    try fm.createDirectory(at: u.deletingLastPathComponent(),withIntermediateDirectories: true)
    return u
}
func record(_ path: String,_ width: Int,_ height: Int,_ alpha: Bool) {
    manifest.append(["file":path,"width":width,"height":height,"transparent":alpha])
}
func draw(_ scene: Scene,_ context: CGContext,_ width: Int,_ height: Int) {
    context.translateBy(x: 0,y: CGFloat(height))
    context.scaleBy(x: CGFloat(width)/CGFloat(scene.width),y: -CGFloat(height)/CGFloat(scene.height))
    context.setAllowsAntialiasing(true); context.setShouldAntialias(true)
    context.setLineCap(.round); context.setLineJoin(.round)
    for shape in scene.shapes {
        context.addPath(shape.path)
        if let fill = shape.fill { context.setFillColor(color(fill)); context.fillPath() }
        if let stroke = shape.stroke {
            context.addPath(shape.path); context.setStrokeColor(color(stroke)); context.setLineWidth(shape.width); context.strokePath()
        }
    }
}
func export(_ scene: Scene,_ name: String,pngWidths: [Int],pdf: Bool = false) throws {
    var svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"\(scene.width)\" height=\"\(scene.height)\" viewBox=\"0 0 \(scene.width) \(scene.height)\"><title>Moments Locaux — Signature B</title>"
    for shape in scene.shapes {
        svg += "<path d=\"\(svgPath(shape.path))\" fill=\"\(shape.fill ?? "none")\" stroke=\"\(shape.stroke ?? "none")\" stroke-width=\"\(shape.width)\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"
    }
    svg += "</svg>\n"
    try svg.write(to: target(name+".svg"),atomically:true,encoding:.utf8)
    record(name+".svg",scene.width,scene.height,!scene.opaque)
    for width in pngWidths {
        let height = Int((Double(width)*Double(scene.height)/Double(scene.width)).rounded())
        let bitmap = scene.opaque ? CGImageAlphaInfo.noneSkipLast.rawValue : CGImageAlphaInfo.premultipliedLast.rawValue
        guard let ctx = CGContext(data:nil,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:bitmap) else { fatalError("Bitmap") }
        draw(scene,ctx,width,height)
        let path = name+"-\(width).png"
        let dest = CGImageDestinationCreateWithURL(try target(path) as CFURL,UTType.png.identifier as CFString,1,nil)!
        CGImageDestinationAddImage(dest,ctx.makeImage()!,nil)
        guard CGImageDestinationFinalize(dest) else { fatalError("PNG") }
        record(path,width,height,!scene.opaque)
    }
    if pdf {
        var box = CGRect(x:0,y:0,width:scene.width,height:scene.height)
        let ctx = CGContext(try target(name+".pdf") as CFURL,mediaBox:&box,nil)!
        ctx.beginPDFPage(nil); draw(scene,ctx,scene.width,scene.height); ctx.endPDFPage(); ctx.closePDF()
        record(name+".pdf",scene.width,scene.height,!scene.opaque)
    }
}

let styles: [(String,String,String)] = [("color",ink,leaf),("reverse",mint,leaf),("ink",ink,ink),("white","#FFFFFF","#FFFFFF"),("black","#000000","#000000"),("leaf",leaf,leaf)]
for (name,base,accent) in styles {
    try export(Scene(width:32,height:32,shapes:symbol(base,accent),opaque:false),"symbols/mark-"+name,pngWidths:[256,512,1024],pdf:true)
    let horizontal = symbol(base,accent,x:4,y:7,size:116) + word("Moments Locaux",size:46,x:144,baseline:86,color:base)
    try export(Scene(width:560,height:134,shapes:horizontal,opaque:false),"logos/logo-horizontal-"+name,pngWidths:[560,1120],pdf:true)
    let stacked = symbol(base,accent,x:105,y:0,size:150) + word("Moments Locaux",size:36,x:25,baseline:200,color:base)
    try export(Scene(width:360,height:232,shapes:stacked,opaque:false),"logos/logo-stacked-"+name,pngWidths:[360,720],pdf:true)
}

// Full-bleed squares; no baked-in rounded corners. iOS 1024 export is opaque.
for (name,bg,base,accent) in [("mint",mint,ink,leaf),("dark",ink,mint,leaf),("white","#FFFFFF",ink,leaf)] {
    let scene = Scene(width:1024,height:1024,shapes:[rect(0,0,1024,1024,bg)]+symbol(base,accent,x:136,y:136,size:752),opaque:true)
    try export(scene,"app-icons/app-icon-"+name,pngWidths:[512,1024])
    try export(scene,"social/avatar-"+name,pngWidths:[400,800])
}
// Android adaptive foreground: visible paths fit inside the central 66/108 safe zone.
try export(Scene(width:108,height:108,shapes:symbol(ink,leaf,x:21,y:21,size:66),opaque:false),"app-icons/android-adaptive-foreground",pngWidths:[108,216,324,432,1024])
try export(Scene(width:108,height:108,shapes:[rect(0,0,108,108,mint)],opaque:true),"app-icons/android-adaptive-background",pngWidths:[432,1024])
try export(Scene(width:108,height:108,shapes:symbol("#000000","#000000",x:21,y:21,size:66),opaque:false),"app-icons/android-themed-monochrome",pngWidths:[432,1024])

for (state,base,accent) in [("active",ink,leaf),("inactive",ink,ink),("disabled",muted,muted),("on-dark",mint,leaf)] {
    let scene=Scene(width:32,height:32,shapes:symbol(base,accent),opaque:false)
    try export(scene,"ui/proposals-"+state,pngWidths:[20,24,28,32,40,48,56,64,72,80,84,96])
}
let favicon=Scene(width:32,height:32,shapes:symbol(ink,leaf),opaque:false)
try export(favicon,"web/favicon",pngWidths:[16,32,48])
let touch=Scene(width:1024,height:1024,shapes:[rect(0,0,1024,1024,mint)]+symbol(ink,leaf,x:136,y:136,size:752),opaque:true)
try export(touch,"web/touch-icon",pngWidths:[180,192,512])
let social=Scene(width:1200,height:630,shapes:[rect(0,0,1200,630,mint)]+symbol(ink,leaf,x:75,y:125,size:360)+word("Moments",size:76,x:485,baseline:286,color:ink)+word("Locaux",size:76,x:485,baseline:382,color:ink),opaque:true)
try export(social,"social/share-card",pngWidths:[1200])
try export(Scene(width:1024,height:1024,shapes:[rect(0,0,1024,1024,mint)]+symbol(ink,leaf,x:136,y:136,size:752),opaque:true),"splash/splash-mark-mint",pngWidths:[1024,2048])
try export(Scene(width:512,height:512,shapes:symbol(ink,leaf,x:64,y:64,size:384),opaque:false),"splash/splash-mark-transparent",pngWidths:[512,1024])

var board = [rect(0,0,1200,950,mint)]
board += word("Signature en mouvement",size:40,x:48,baseline:72,color:ink)
board += word("Moments Locaux / Variante B",size:17,x:50,baseline:108,color:muted)
board += [rect(48,145,344,328,"#FFFFFF"),rect(428,145,344,328,ink),rect(808,145,344,328,"#E8F5E9")]
board += symbol(ink,leaf,x:120,y:175,size:200) + symbol(mint,leaf,x:500,y:175,size:200) + symbol(ink,ink,x:880,y:175,size:200)
board += word("Couleur",size:18,x:75,baseline:440,color:ink) + word("Fond sombre",size:18,x:455,baseline:440,color:mint) + word("Monochrome",size:18,x:835,baseline:440,color:ink)
board += word("Logo horizontal",size:17,x:50,baseline:525,color:muted)
board += symbol(ink,leaf,x:48,y:550,size:112) + word("Moments Locaux",size:48,x:188,baseline:628,color:ink)
board += word("Application",size:17,x:850,baseline:525,color:muted)
board += [rect(850,548,220,220,"#FFFFFF")] + symbol(ink,leaf,x:879,y:577,size:162)
board += word("Navigation / taille reelle",size:17,x:50,baseline:736,color:muted)
for (i,size) in [20,24,28,32,48].enumerated() {
    let x = CGFloat(50+i*120)
    board += symbol(ink,leaf,x:x,y:770,size:CGFloat(size))
    board += word("\(size) px",size:12,x:x,baseline:845,color:muted)
}
board += word("SVG / PNG / PDF / ICO — Geometrie B conservee — Pack du 06.11.2026",size:14,x:50,baseline:913,color:muted)
try export(Scene(width:1200,height:950,shapes:board,opaque:true),"preview/brand-board",pngWidths:[1200])

let data = try JSONSerialization.data(withJSONObject:["reference":"BRAND-SIGNATURE-B-001","source":"Variant B — Signature en mouvement","date":"2026-11-06","color_space":"sRGB","files":manifest],options:[.prettyPrinted,.sortedKeys])
try data.write(to:target("manifest.json"))
print("Exported \(manifest.count) assets to \(root.path)")
