import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import theme from "assets/theme";
import { MaterialUIControllerProvider } from "context";

/**
 * Renders `element` inside the providers the app's components expect, for tests.
 * Returns the container and a function that unmounts and removes it. Dialogs
 * render into document.body, not the container, so query there for those.
 */
export async function renderInApp(element) {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter>
        <MaterialUIControllerProvider>
          <ThemeProvider theme={theme}>{element}</ThemeProvider>
        </MaterialUIControllerProvider>
      </MemoryRouter>
    );
  });

  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}
