import { AudioClip, AudioSource, Node, resources, director } from "cc";
import { audioSettings } from "./AudioSettings";

/**
 * 全局音频管理器
 * 管理背景音乐的播放、停止和切换
 */
export class AudioManager {
  private static _instance: AudioManager | null = null;
  private _bgmAudioSource: AudioSource | null = null;
  private _bgmNode: Node | null = null;
  private _currentBgmPath: string = "";

  private constructor() {}

  static get instance(): AudioManager {
    if (!this._instance) {
      this._instance = new AudioManager();
    }
    return this._instance;
  }

  /**
   * 播放背景音乐
   * @param path 音频资源路径（相对于 resources 目录）
   * @param loop 是否循环播放
   * @param volume 音量 (0-1)，如果不指定则使用用户设置的音乐音量
   */
  playBGM(path: string, loop: boolean = true, volume?: number) {
    // 如果正在播放相同的音乐，不重复加载
    if (this._currentBgmPath === path && this._bgmAudioSource?.playing) {
      console.log(`背景音乐 ${path} 已在播放中`);
      return;
    }

    // 停止当前音乐
    this.stopBGM();

    console.log(`开始加载背景音乐: ${path}`);
    resources.load(path, AudioClip, (err, clip) => {
      if (err) {
        console.error(`加载背景音乐失败: ${path}`, err);
        return;
      }

      if (!clip) {
        console.error(`加载的音频资源为空: ${path}`);
        return;
      }

      console.log(`背景音乐加载成功: ${path}`);

      // 创建新的音频节点
      this._bgmNode = new Node("BGM_Node");
      // 标记为常驻节点，防止场景切换时被销毁
      director.addPersistRootNode(this._bgmNode);

      this._bgmAudioSource = this._bgmNode.addComponent(AudioSource);
      this._bgmAudioSource.clip = clip;
      this._bgmAudioSource.loop = loop;
      // 使用用户设置的音乐音量，如果没有指定则使用传入的volume或默认值0.5
      const userVolume = audioSettings.loaded ? audioSettings.musicVolume / 100 : 0.5;
      this._bgmAudioSource.volume = volume !== undefined ? volume : userVolume;
      this._bgmAudioSource.play();
      this._currentBgmPath = path;

      console.log(`背景音乐播放状态: ${this._bgmAudioSource.playing}`);

      // 如果浏览器阻止自动播放，监听用户交互后重试
      if (!this._bgmAudioSource.playing) {
        console.warn("浏览器阻止自动播放，等待用户交互...");
        const playOnInteraction = () => {
          if (this._bgmAudioSource && !this._bgmAudioSource.playing) {
            this._bgmAudioSource.play();
            console.log("用户交互后播放背景音乐");
          }
          document.removeEventListener("touchstart", playOnInteraction);
          document.removeEventListener("click", playOnInteraction);
        };
        document.addEventListener("touchstart", playOnInteraction, {
          once: true,
        });
        document.addEventListener("click", playOnInteraction, { once: true });
      }
    });
  }

  /**
   * 停止背景音乐
   */
  stopBGM() {
    if (this._bgmAudioSource && this._bgmAudioSource.isValid) {
      console.log(`停止背景音乐: ${this._currentBgmPath}`);
      this._bgmAudioSource.stop();
      this._bgmAudioSource.node.destroy();
      this._bgmAudioSource = null;
    }
    this._currentBgmPath = "";
  }

  /**
   * 暂停背景音乐
   */
  pauseBGM() {
    if (this._bgmAudioSource && this._bgmAudioSource.playing) {
      this._bgmAudioSource.pause();
      console.log("暂停背景音乐");
    }
  }

  /**
   * 恢复背景音乐
   */
  resumeBGM() {
    if (this._bgmAudioSource && !this._bgmAudioSource.playing) {
      this._bgmAudioSource.play();
      console.log("恢复背景音乐");
    }
  }

  /**
   * 设置背景音乐音量
   */
  setBGMVolume(volume: number) {
    if (this._bgmAudioSource) {
      this._bgmAudioSource.volume = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * 获取当前播放的背景音乐路径
   */
  get currentBgmPath(): string {
    return this._currentBgmPath;
  }

  /**
   * 是否正在播放背景音乐
   */
  get isPlaying(): boolean {
    return this._bgmAudioSource?.playing || false;
  }
}

// 导出单例实例
export const audioManager = AudioManager.instance;
