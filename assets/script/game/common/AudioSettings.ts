import { HttpClient } from "./network/HttpClient";
import { NetConfig } from "./network/NetConfig";

export interface AudioSettings {
  voice_gender: "male" | "female";
  sound_volume: number;
  music_volume: number;
}

/**
 * 音频设置管理器
 * 管理用户的音频偏好设置（语音性别、音效音量、音乐音量）
 */
export class AudioSettingsManager {
  private static _instance: AudioSettingsManager | null = null;
  private _settings: AudioSettings = {
    voice_gender: "female",
    sound_volume: 50,
    music_volume: 50,
  };
  private _loaded = false;

  private constructor() {}

  static get instance(): AudioSettingsManager {
    if (!this._instance) {
      this._instance = new AudioSettingsManager();
    }
    return this._instance;
  }

  /** 获取当前设置 */
  get settings(): AudioSettings {
    return { ...this._settings };
  }

  /** 获取语音性别 */
  get voiceGender(): "male" | "female" {
    return this._settings.voice_gender;
  }

  /** 获取音效音量 (0-100) */
  get soundVolume(): number {
    return this._settings.sound_volume;
  }

  /** 获取音乐音量 (0-100) */
  get musicVolume(): number {
    return this._settings.music_volume;
  }

  /** 是否已加载设置 */
  get loaded(): boolean {
    return this._loaded;
  }

  /** 从服务器加载设置 */
  async load(): Promise<void> {
    try {
      const response = await HttpClient.get<AudioSettings>(
        NetConfig.API.AUDIO_SETTINGS
      );
      this._settings = response;
      this._loaded = true;
      console.log("音频设置加载成功:", this._settings);
    } catch (e) {
      console.error("加载音频设置失败:", e);
      // 使用默认设置
      this._loaded = true;
    }
  }

  /** 更新设置到服务器 */
  async update(settings: Partial<AudioSettings>): Promise<void> {
    try {
      const response = await HttpClient.post<AudioSettings>(
        NetConfig.API.AUDIO_SETTINGS,
        settings
      );
      this._settings = response;
      console.log("音频设置更新成功:", this._settings);
    } catch (e) {
      console.error("更新音频设置失败:", e);
      throw e;
    }
  }

  /** 设置语音性别 */
  async setVoiceGender(gender: "male" | "female"): Promise<void> {
    await this.update({ voice_gender: gender });
  }

  /** 设置音效音量 */
  async setSoundVolume(volume: number): Promise<void> {
    const clamped = Math.max(0, Math.min(100, volume));
    await this.update({ sound_volume: clamped });
  }

  /** 设置音乐音量 */
  async setMusicVolume(volume: number): Promise<void> {
    const clamped = Math.max(0, Math.min(100, volume));
    await this.update({ music_volume: clamped });
  }

  /** 重置为默认设置 */
  reset(): void {
    this._settings = {
      voice_gender: "female",
      sound_volume: 50,
      music_volume: 50,
    };
    this._loaded = false;
  }
}

// 导出单例实例
export const audioSettings = AudioSettingsManager.instance;
