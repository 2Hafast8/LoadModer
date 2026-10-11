import type { DesktopAPI } from '../../preload/index.js';

declare global {
  interface Window {
    api: DesktopAPI;
  }
}
