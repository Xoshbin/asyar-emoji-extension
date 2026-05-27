import 'asyar-sdk/tokens.css';
import { mount } from 'svelte';
import {
  ExtensionContext,
  extensionBridge,
  registerIconElement,
  type Extension,
  type IExtensionManager,
} from 'asyar-sdk/view';
import manifest from '../manifest.json';
import DefaultView from './views/DefaultView.svelte';
import LearnedShortcodesView from './views/LearnedShortcodesView.svelte';

class EmojiViewExtension implements Extension {
  private extensionManager?: IExtensionManager;

  async initialize(ctx: ExtensionContext): Promise<void> {
    this.extensionManager = ctx.getService<IExtensionManager>('extensions');
  }

  async activate(): Promise<void> {}
  async deactivate(): Promise<void> {}

  async executeCommand(commandId: string): Promise<unknown> {
    if (commandId === 'open') {
      this.extensionManager?.navigateToView(`${extensionId}/DefaultView`);
      return { type: 'view', viewPath: `${extensionId}/DefaultView` };
    }
    if (commandId === 'manage-learned') {
      this.extensionManager?.navigateToView(`${extensionId}/LearnedShortcodesView`);
      return { type: 'view', viewPath: `${extensionId}/LearnedShortcodesView` };
    }
    return undefined;
  }

  onUnload = (): void => {};
}

const extensionId =
  window.location.hostname === 'localhost' ||
  window.location.hostname === 'asyar-extension.localhost'
    ? window.location.pathname.split('/').filter(Boolean)[0] ||
      'org.asyar.emoji'
    : window.location.hostname || 'org.asyar.emoji';

const context = new ExtensionContext();
context.setExtensionId(extensionId);
registerIconElement();

const viewExtension = new EmojiViewExtension();
extensionBridge.registerManifest(
  manifest as Parameters<typeof extensionBridge.registerManifest>[0],
);
extensionBridge.registerExtensionImplementation(extensionId, viewExtension);

window.addEventListener('keydown', (event) => {
  const isCommandK = (event.metaKey || event.ctrlKey) && event.key === 'k';
  if (isCommandK) {
    event.preventDefault();
    window.parent.postMessage(
      {
        type: 'asyar:extension:keydown',
        payload: {
          key: event.key,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
        },
      },
      '*',
    );
  }
});

void (async () => {
  await viewExtension.initialize(context);
  await viewExtension.activate();
})();

const viewName = new URLSearchParams(window.location.search).get('view');
const target = document.getElementById('app');
if (viewName === 'DefaultView' && target) {
  mount(DefaultView, { target, props: { context } });
} else if (viewName === 'LearnedShortcodesView' && target) {
  mount(LearnedShortcodesView, { target, props: { context } });
}
