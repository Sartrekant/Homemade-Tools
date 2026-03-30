import { useState, useRef } from "react";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { motion } from "framer-motion";

const EASING = [0.22, 1, 0.36, 1] as const;

type ErrorLevel = "L" | "M" | "Q" | "H";

const PRESETS = [
  { label: "URL", placeholder: "https://landsvig.com", value: "" },
  { label: "Telefon", placeholder: "tel:+4512345678", value: "tel:" },
  { label: "Email", placeholder: "mailto:hej@firma.dk", value: "mailto:" },
  { label: "SMS", placeholder: "sms:+4512345678", value: "sms:" },
  { label: "WiFi", placeholder: 'WIFI:S:netværk;T:WPA;P:adgangskode;;', value: "WIFI:S:;T:WPA;P:;;" },
];

export default function QRCodeGenerator() {
  const [text, setText] = useState("https://landsvig.com");
  const [size, setSize] = useState(256);
  const [fgColor, setFgColor] = useState("#2e2f2e");
  const [bgColor, setBgColor] = useState("#f9f7f2");
  const [errorLevel, setErrorLevel] = useState<ErrorLevel>("M");
  const [activePreset, setActivePreset] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handlePreset = (index: number) => {
    setActivePreset(index);
    setText(PRESETS[index].placeholder);
  };

  const handleDownloadPNG = () => {
    const canvas = document.querySelector<HTMLCanvasElement>("#qr-canvas canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "qr-kode.png";
    a.click();
  };

  const handleDownloadSVG = () => {
    const svg = document.querySelector<SVGSVGElement>("#qr-svg svg");
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qr-kode.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  const isEmpty = text.trim() === "";

  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      {/* Header */}
      <header className="border-b border-foreground/10 px-6 py-5 flex items-center justify-between">
        <a href="/" className="text-xs tracking-widest uppercase opacity-50 hover:opacity-100 transition-opacity">
          ← LANDSVIG
        </a>
        <span className="text-xs tracking-widest uppercase opacity-40">QR-KODE GENERATOR</span>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASING }}
          className="mb-14"
        >
          <h1 className="font-serif text-5xl md:text-6xl tracking-tight mb-4">
            QR-kode Generator
          </h1>
          <p className="text-sm opacity-50 max-w-md">
            Generer professionelle QR-koder til dit håndværkerfirma — til hjemmeside, visitkort, faktura eller tilbud.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Controls */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: EASING }}
            className="space-y-8"
          >
            {/* Presets */}
            <div>
              <label className="block text-xs tracking-widest uppercase opacity-50 mb-3">Type</label>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset, i) => (
                  <button
                    key={preset.label}
                    onClick={() => handlePreset(i)}
                    className={`px-3 py-1.5 text-xs tracking-wider uppercase border transition-colors ${
                      activePreset === i
                        ? "bg-foreground text-background border-foreground"
                        : "bg-transparent text-foreground border-foreground/20 hover:border-foreground/60"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Text input */}
            <div>
              <label className="block text-xs tracking-widest uppercase opacity-50 mb-3">Indhold</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                className="w-full bg-transparent border border-foreground/20 px-4 py-3 text-sm focus:outline-none focus:border-foreground/60 resize-none transition-colors"
                placeholder={PRESETS[activePreset]?.placeholder}
              />
            </div>

            {/* Size */}
            <div>
              <label className="block text-xs tracking-widest uppercase opacity-50 mb-3">
                Størrelse — {size}px
              </label>
              <input
                type="range"
                min={128}
                max={512}
                step={16}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="w-full accent-foreground"
              />
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs tracking-widest uppercase opacity-50 mb-3">Forgrundsfarve</label>
                <div className="flex items-center gap-3 border border-foreground/20 px-3 py-2">
                  <input
                    type="color"
                    value={fgColor}
                    onChange={(e) => setFgColor(e.target.value)}
                    className="w-6 h-6 cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="text-xs opacity-60 font-mono">{fgColor}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs tracking-widest uppercase opacity-50 mb-3">Baggrundsfarve</label>
                <div className="flex items-center gap-3 border border-foreground/20 px-3 py-2">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-6 h-6 cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="text-xs opacity-60 font-mono">{bgColor}</span>
                </div>
              </div>
            </div>

            {/* Error correction */}
            <div>
              <label className="block text-xs tracking-widest uppercase opacity-50 mb-3">Fejlkorrektion</label>
              <div className="flex gap-2">
                {(["L", "M", "Q", "H"] as ErrorLevel[]).map((level) => (
                  <button
                    key={level}
                    onClick={() => setErrorLevel(level)}
                    className={`px-4 py-2 text-xs tracking-wider border transition-colors ${
                      errorLevel === level
                        ? "bg-foreground text-background border-foreground"
                        : "bg-transparent text-foreground border-foreground/20 hover:border-foreground/60"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <p className="text-xs opacity-30 mt-2">
                L = 7% · M = 15% · Q = 25% · H = 30% gendannelse
              </p>
            </div>
          </motion.div>

          {/* Preview & Download */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: EASING }}
            className="flex flex-col items-center gap-8"
          >
            {/* QR Preview */}
            <div className="w-full flex flex-col items-center">
              <label className="block text-xs tracking-widest uppercase opacity-50 mb-6 self-start">Forhåndsvisning</label>
              <div
                className="border border-foreground/10 p-6 flex items-center justify-center"
                style={{ background: bgColor }}
              >
                {isEmpty ? (
                  <div
                    className="flex items-center justify-center text-xs opacity-30"
                    style={{ width: size, height: size }}
                  >
                    Indtast indhold
                  </div>
                ) : (
                  <>
                    {/* Hidden canvas for PNG download */}
                    <div id="qr-canvas" className="hidden">
                      <QRCodeCanvas
                        value={text}
                        size={size}
                        fgColor={fgColor}
                        bgColor={bgColor}
                        level={errorLevel}
                        marginSize={2}
                      />
                    </div>
                    {/* Visible SVG preview */}
                    <div id="qr-svg">
                      <QRCodeSVG
                        value={text}
                        size={size}
                        fgColor={fgColor}
                        bgColor={bgColor}
                        level={errorLevel}
                        marginSize={2}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Download buttons */}
            <div className="w-full grid grid-cols-2 gap-3">
              <button
                onClick={handleDownloadSVG}
                disabled={isEmpty}
                className="border border-foreground/20 px-4 py-3 text-xs tracking-widest uppercase hover:bg-foreground hover:text-background hover:border-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Download SVG
              </button>
              <button
                onClick={handleDownloadPNG}
                disabled={isEmpty}
                className="bg-foreground text-background px-4 py-3 text-xs tracking-widest uppercase hover:opacity-80 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Download PNG
              </button>
            </div>

            {/* Usage hint */}
            <p className="text-xs opacity-30 text-center max-w-xs">
              SVG er vektorformat — ideel til print. PNG er rasterbillede — ideel til digitale medier.
            </p>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
