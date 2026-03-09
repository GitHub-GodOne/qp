import { AudioClip, AudioSource, Node, resources } from "cc";
import { audioSettings } from "./AudioSettings";

/**
 * 音效管理器
 * 管理游戏中的音效播放（非背景音乐）
 */
export class SoundEffectManager {
  private static _instance: SoundEffectManager | null = null;
  private _audioNode: Node | null = null;
  private _audioSource: AudioSource | null = null;

  private constructor() {}

  static get instance(): SoundEffectManager {
    if (!this._instance) {
      this._instance = new SoundEffectManager();
    }
    return this._instance;
  }

  /**
   * 播放音效
   * @param path 音频资源路径（相对于 resources 目录）
   * @param volumeScale 音量缩放 (0-1)，会乘以用户设置的音效音量
   */
  play(path: string, volumeScale: number = 1.0): void {
    const userVolume = audioSettings.soundVolume / 100; // 0-1
    const finalVolume = userVolume * volumeScale;

    if (finalVolume <= 0) {
      return; // 静音时不播放
    }

    resources.load(path, AudioClip, (err, clip) => {
      if (err) {
        console.error(`加载音效失败: ${path}`, err);
        return;
      }

      if (!clip) {
        console.error(`音效资源为空: ${path}`);
        return;
      }

      // 创建临时节点播放音效
      if (!this._audioNode) {
        this._audioNode = new Node("SoundEffect_Node");
      }

      if (!this._audioSource) {
        this._audioSource = this._audioNode.addComponent(AudioSource);
      }

      this._audioSource.clip = clip;
      this._audioSource.loop = false;
      this._audioSource.volume = finalVolume;
      this._audioSource.playOneShot(clip, finalVolume);
    });
  }

  /**
   * 播放斗牛游戏音效（根据用户性别设置选择男声或女声）
   * @param soundName 音效名称（如 "牛牛"、"牛一"、"没牛"等）
   * @param volumeScale 音量缩放 (0-1)
   */
  playBullSound(soundName: string, volumeScale: number = 1.0): void {
    const gender = audioSettings.voiceGender === "male" ? "男" : "女";
    const path = `Sound/SoundNiuNiuPutonghua/${soundName}${gender}`;
    this.play(path, volumeScale);
  }

  /**
   * 停止所有音效
   */
  stopAll(): void {
    if (this._audioSource && this._audioSource.isValid) {
      this._audioSource.stop();
    }
  }
}

// 导出单例实例
export const soundEffect = SoundEffectManager.instance;
