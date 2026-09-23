import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ThemeProvider, useTheme } from "../app/theme";

function ThemeProbe() {
  const { theme, toggle } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button type="button" onClick={toggle}>
        Cambiar
      </button>
    </div>
  );
}

describe("ThemeProvider", () => {
  it("alterna entre claro y oscuro", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    const label = screen.getByTestId("theme");
    const initial = label.textContent;
    await user.click(screen.getByRole("button", { name: "Cambiar" }));
    expect(label.textContent).not.toBe(initial);
  });
});
