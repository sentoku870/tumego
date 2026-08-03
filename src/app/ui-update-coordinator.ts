// ============ UIUpdateCoordinator ============
// EventBus.onUIUpdate() で呼ばれる複数コンポーネントの更新手順を集約する。
// これまで composition-root.ts 内に無名で書かれていた 6 メソッドの直書きを
// 1 クラスに閉じ込め、composition-root を「物体の組み立て」だけに専念させる。

import { FeatureMenuController } from '../ui/controllers/feature-menu-controller.js';
import { ToolbarController } from '../ui/controllers/toolbar-controller.js';
import { PreferencesStore } from '../services/preferences-store.js';
import { Renderer } from '../renderer/renderer.js';

export class UIUpdateCoordinator {
  constructor(
    private readonly renderer: Renderer,
    private readonly feature: FeatureMenuController,
    private readonly toolbar: ToolbarController,
    private readonly preferences: PreferencesStore
  ) {}

  /** 1 回の UI 更新サイクル: 再描画 + 全コントローラの UI 状態反映 */
  applyUIUpdate(): void {
    this.renderer.render();
    this.renderer.updateInfo();
    this.renderer.updateSlider();
    this.renderer.updateCapturedStones(
      this.preferences.state.solve.showCapturedStones
    );
    this.feature.updateMenuState();
    this.toolbar.updateToolbarState();
  }
}
