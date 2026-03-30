import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import QRCodeGenerator from "@/pages/QRCodeGenerator";

// qrcode.react renders SVG/canvas — stub them so jsdom doesn't choke
vi.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value, size, fgColor, bgColor, level }: Record<string, unknown>) => (
    <svg
      data-testid="qr-svg"
      data-value={value}
      data-size={size}
      data-fg={fgColor}
      data-bg={bgColor}
      data-level={level}
    />
  ),
  QRCodeCanvas: ({ value, size }: Record<string, unknown>) => (
    <canvas data-testid="qr-canvas" data-value={value} data-size={size} />
  ),
}));

// stub framer-motion to avoid animation issues in jsdom
vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, tag: string) => {
        const Component = ({ children, ...rest }: React.HTMLAttributes<HTMLElement>) => {
          const props = Object.fromEntries(
            Object.entries(rest).filter(([k]) => !k.startsWith("initial") && !k.startsWith("animate") && !k.startsWith("transition") && !k.startsWith("whileInView") && !k.startsWith("viewport"))
          );
          return <div {...props}>{children}</div>;
        };
        Component.displayName = tag;
        return Component;
      },
    }
  ),
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <QRCodeGenerator />
    </MemoryRouter>
  );

describe("QRCodeGenerator", () => {
  describe("initial render", () => {
    it("renders the page heading", () => {
      renderPage();
      expect(screen.getByRole("heading", { name: /qr-kode generator/i })).toBeInTheDocument();
    });

    it("renders back link to homepage", () => {
      renderPage();
      const link = screen.getByRole("link", { name: /landsvig/i });
      expect(link).toHaveAttribute("href", "/");
    });

    it("renders the header label in the nav bar", () => {
      renderPage();
      const labels = screen.getAllByText(/qr-kode generator/i);
      // one in the header <span>, one in the <h1>
      expect(labels.length).toBeGreaterThanOrEqual(2);
    });

    it("renders the textarea with default value", () => {
      renderPage();
      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveValue("https://landsvig.com");
    });

    it("renders QR code on initial load (default text is not empty)", () => {
      renderPage();
      expect(screen.getByTestId("qr-svg")).toBeInTheDocument();
    });

    it("passes default text value to QR SVG", () => {
      renderPage();
      const qr = screen.getByTestId("qr-svg");
      expect(qr).toHaveAttribute("data-value", "https://landsvig.com");
    });

    it("passes default size 256 to QR SVG", () => {
      renderPage();
      const qr = screen.getByTestId("qr-svg");
      expect(qr).toHaveAttribute("data-size", "256");
    });

    it("passes default error level M to QR SVG", () => {
      renderPage();
      const qr = screen.getByTestId("qr-svg");
      expect(qr).toHaveAttribute("data-level", "M");
    });
  });

  describe("preset buttons", () => {
    const PRESETS = [
      { label: "URL", value: "https://landsvig.com" },
      { label: "Telefon", value: "tel:+4512345678" },
      { label: "Email", value: "mailto:hej@firma.dk" },
      { label: "SMS", value: "sms:+4512345678" },
      { label: "WiFi", value: "WIFI:S:netværk;T:WPA;P:adgangskode;;" },
    ];

    it("renders all 5 preset buttons", () => {
      renderPage();
      for (const p of PRESETS) {
        expect(screen.getByRole("button", { name: p.label })).toBeInTheDocument();
      }
    });

    it("URL preset is active by default (solid style)", () => {
      renderPage();
      const btn = screen.getByRole("button", { name: "URL" });
      expect(btn.className).toMatch(/bg-foreground/);
    });

    it("clicking a preset updates the textarea to its placeholder", async () => {
      renderPage();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Telefon" }));
      expect(screen.getByRole("textbox")).toHaveValue("tel:+4512345678");
    });

    it("clicking a preset marks it as active", async () => {
      renderPage();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Email" }));
      const btn = screen.getByRole("button", { name: "Email" });
      expect(btn.className).toMatch(/bg-foreground/);
    });

    it("clicking a preset deactivates the previous active preset", async () => {
      renderPage();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "SMS" }));
      const urlBtn = screen.getByRole("button", { name: "URL" });
      expect(urlBtn.className).not.toMatch(/^bg-foreground/);
    });

    it("WiFi preset sets correct placeholder", async () => {
      renderPage();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "WiFi" }));
      expect(screen.getByRole("textbox")).toHaveValue(
        "WIFI:S:netværk;T:WPA;P:adgangskode;;"
      );
    });
  });

  describe("text input", () => {
    it("updating the textarea updates the QR value", () => {
      renderPage();
      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "https://example.com" } });
      expect(screen.getByTestId("qr-svg")).toHaveAttribute("data-value", "https://example.com");
    });

    it("shows empty state message when textarea is cleared", () => {
      renderPage();
      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "" } });
      expect(screen.getByText(/indtast indhold/i)).toBeInTheDocument();
    });

    it("hides QR code when text is empty", () => {
      renderPage();
      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "" } });
      expect(screen.queryByTestId("qr-svg")).not.toBeInTheDocument();
    });

    it("renders QR with new value after changing textarea content", () => {
      renderPage();
      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "https://nyt-indhold.dk" } });
      const qr = screen.getByTestId("qr-svg");
      expect(qr).toBeInTheDocument();
      expect(qr).toHaveAttribute("data-value", "https://nyt-indhold.dk");
    });
  });

  describe("size slider", () => {
    it("renders the size slider", () => {
      renderPage();
      const slider = screen.getByRole("slider");
      expect(slider).toBeInTheDocument();
    });

    it("slider defaults to 256", () => {
      renderPage();
      expect(screen.getByRole("slider")).toHaveValue("256");
    });

    it("slider has correct min/max/step", () => {
      renderPage();
      const slider = screen.getByRole("slider");
      expect(slider).toHaveAttribute("min", "128");
      expect(slider).toHaveAttribute("max", "512");
      expect(slider).toHaveAttribute("step", "16");
    });

    it("changing slider updates the displayed size label", () => {
      renderPage();
      const slider = screen.getByRole("slider");
      fireEvent.change(slider, { target: { value: "320" } });
      expect(screen.getByText(/320px/)).toBeInTheDocument();
    });

    it("changing slider updates the QR size prop", () => {
      renderPage();
      const slider = screen.getByRole("slider");
      fireEvent.change(slider, { target: { value: "384" } });
      expect(screen.getByTestId("qr-svg")).toHaveAttribute("data-size", "384");
    });
  });

  describe("error correction level", () => {
    const levels = ["L", "M", "Q", "H"];

    it("renders all four error level buttons", () => {
      renderPage();
      for (const lvl of levels) {
        expect(screen.getByRole("button", { name: lvl })).toBeInTheDocument();
      }
    });

    it("M is active by default", () => {
      renderPage();
      const btn = screen.getByRole("button", { name: "M" });
      expect(btn.className).toMatch(/bg-foreground/);
    });

    it("clicking L sets it as active and passes to QR", async () => {
      renderPage();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "L" }));
      expect(screen.getByRole("button", { name: "L" }).className).toMatch(/bg-foreground/);
      expect(screen.getByTestId("qr-svg")).toHaveAttribute("data-level", "L");
    });

    it("clicking Q passes Q to QR SVG", async () => {
      renderPage();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Q" }));
      expect(screen.getByTestId("qr-svg")).toHaveAttribute("data-level", "Q");
    });

    it("clicking H passes H to QR SVG", async () => {
      renderPage();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "H" }));
      expect(screen.getByTestId("qr-svg")).toHaveAttribute("data-level", "H");
    });

    it("renders error correction info text", () => {
      renderPage();
      expect(screen.getByText(/7%/)).toBeInTheDocument();
      expect(screen.getByText(/30%/)).toBeInTheDocument();
    });
  });

  describe("color pickers", () => {
    it("renders foreground color input", () => {
      renderPage();
      const inputs = document.querySelectorAll("input[type='color']");
      expect(inputs).toHaveLength(2);
    });

    it("fg color defaults to #2e2f2e", () => {
      renderPage();
      const [fg] = Array.from(document.querySelectorAll("input[type='color']"));
      expect(fg).toHaveValue("#2e2f2e");
    });

    it("bg color defaults to #f9f7f2", () => {
      renderPage();
      const [, bg] = Array.from(document.querySelectorAll("input[type='color']"));
      expect(bg).toHaveValue("#f9f7f2");
    });

    it("changing fg color updates QR data-fg attribute", () => {
      renderPage();
      const [fg] = Array.from(document.querySelectorAll("input[type='color']"));
      fireEvent.change(fg, { target: { value: "#ff0000" } });
      expect(screen.getByTestId("qr-svg")).toHaveAttribute("data-fg", "#ff0000");
    });

    it("changing bg color updates QR data-bg attribute", () => {
      renderPage();
      const [, bg] = Array.from(document.querySelectorAll("input[type='color']"));
      fireEvent.change(bg, { target: { value: "#0000ff" } });
      expect(screen.getByTestId("qr-svg")).toHaveAttribute("data-bg", "#0000ff");
    });

    it("renders hex value labels for both colors", () => {
      renderPage();
      expect(screen.getByText("#2e2f2e")).toBeInTheDocument();
      expect(screen.getByText("#f9f7f2")).toBeInTheDocument();
    });
  });

  describe("download buttons", () => {
    it("renders Download SVG button", () => {
      renderPage();
      expect(screen.getByRole("button", { name: /download svg/i })).toBeInTheDocument();
    });

    it("renders Download PNG button", () => {
      renderPage();
      expect(screen.getByRole("button", { name: /download png/i })).toBeInTheDocument();
    });

    it("download buttons are enabled when text is present", () => {
      renderPage();
      expect(screen.getByRole("button", { name: /download svg/i })).not.toBeDisabled();
      expect(screen.getByRole("button", { name: /download png/i })).not.toBeDisabled();
    });

    it("download buttons are disabled when textarea is empty", async () => {
      renderPage();
      const user = userEvent.setup();
      await user.clear(screen.getByRole("textbox"));
      expect(screen.getByRole("button", { name: /download svg/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /download png/i })).toBeDisabled();
    });

    it("SVG download triggers XMLSerializer and creates anchor click", () => {
      renderPage();
      // Inject a real svg into the #qr-svg div so the handler can find it
      const svgContainer = document.getElementById("qr-svg");
      if (svgContainer) {
        const realSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgContainer.appendChild(realSvg);
      }

      const createObjectURL = vi.fn(() => "blob:fake-url");
      const revokeObjectURL = vi.fn();
      Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, writable: true });
      Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, writable: true });

      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

      fireEvent.click(screen.getByRole("button", { name: /download svg/i }));

      expect(createObjectURL).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");

      clickSpy.mockRestore();
    });

    it("PNG download calls toDataURL and triggers anchor click", () => {
      // jsdom doesn't implement toDataURL — stub the prototype
      const toDataURLSpy = vi
        .spyOn(HTMLCanvasElement.prototype, "toDataURL")
        .mockReturnValue("data:image/png;base64,fake");
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => {});

      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /download png/i }));

      expect(toDataURLSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();

      toDataURLSpy.mockRestore();
      clickSpy.mockRestore();
    });

    it("renders format hint text", () => {
      renderPage();
      expect(screen.getByText(/SVG er vektorformat/i)).toBeInTheDocument();
    });
  });

  describe("QR canvas (hidden, for PNG export)", () => {
    it("renders the hidden canvas QR element", () => {
      renderPage();
      expect(screen.getByTestId("qr-canvas")).toBeInTheDocument();
    });

    it("canvas QR receives same value as SVG QR", () => {
      renderPage();
      const svg = screen.getByTestId("qr-svg");
      const canvas = screen.getByTestId("qr-canvas");
      expect(canvas).toHaveAttribute("data-value", svg.getAttribute("data-value"));
    });
  });

  describe("accessibility", () => {
    it("textarea has an associated label (via sibling label)", () => {
      renderPage();
      expect(screen.getByText(/indhold/i)).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("size slider is labelled", () => {
      renderPage();
      expect(screen.getByRole("slider")).toBeInTheDocument();
      expect(screen.getByText(/størrelse/i)).toBeInTheDocument();
    });
  });
});
