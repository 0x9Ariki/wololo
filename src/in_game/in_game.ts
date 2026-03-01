import {
  OWGames,
  OWGamesEvents,
  OWHotkeys
} from "@overwolf/overwolf-api-ts";

import { AppWindow } from "../AppWindow";
import { kHotkeys, kWindowNames, kGamesFeatures } from "../consts";

// Kendi yazdığımız Telemetri İzleyicisini içeri aktarıyoruz
import { TelemetryWatcher } from "./TelemetryWatcher"; 

import WindowState = overwolf.windows.WindowStateEx;

class InGame extends AppWindow {
  private static _instance: InGame;
  private _gameEventsListener: OWGamesEvents;
  private _telemetryWatcher: TelemetryWatcher; // Telemetri değişkenimiz
  
  private _eventsLog: HTMLElement;
  private _infoLog: HTMLElement;

  private constructor() {
    super(kWindowNames.inGame);

    this._eventsLog = document.getElementById('eventsLog');
    this._infoLog = document.getElementById('infoLog');

    this.setToggleHotkeyBehavior();
    this.setToggleHotkeyText();
  }

  public static instance() {
    if (!this._instance) {
      this._instance = new InGame();
    }
    return this._instance;
  }

  public async run() {
    // Oyunun tamamen yüklenmesi için 5 saniye bekle
    await new Promise(resolve => setTimeout(resolve, 5000));

    const gameClassId = await this.getCurrentGameClassId();
    
    // consts.ts içinden bu oyun için hangi özellikleri dinleyeceğimizi alıyoruz
    const gameFeatures = kGamesFeatures.get(gameClassId);

    if (gameFeatures && gameFeatures.length) {
      this._gameEventsListener = new OWGamesEvents(
        {
          onInfoUpdates: this.onInfoUpdates.bind(this),
          onNewEvents: this.onNewEvents.bind(this)
        },
        gameFeatures
      );

      this._gameEventsListener.start();
    } else {
      console.warn(`Oyun ID ${gameClassId} için dinlenecek özellik (feature) bulunamadı.`);
    }

    // === AGE OF EMPIRES 2 TELEMETRİ İZLEYİCİSİ ===
    this._telemetryWatcher = new TelemetryWatcher();
    this._telemetryWatcher.startWatching((eventName, attributes) => {
      // Yakalanan olayı yeni yazdığımız fonksiyona gönderiyoruz
      this.onAoeTelemetryEvent(eventName, attributes);
    });
  }

  // --- Yeni Eklenen UI Güncelleme Fonksiyonu ---
  private onAoeTelemetryEvent(eventName: string, attributes: any) {
    console.log(`[AoE 2] ${eventName} yakalandı!`);
    
    // Sağdaki log ekranına ham veriyi yazdır
    this.logLine(this._eventsLog, { AoE_Event: eventName, Data: attributes }, true);

    // HTML Arayüzündeki (UI) elementleri yakala
    const statusEl = document.getElementById('status-text');
    const scoreEl = document.getElementById('val-score');
    const woodEl = document.getElementById('val-wood');
    const foodEl = document.getElementById('val-food');
    const goldEl = document.getElementById('val-gold');
    const stoneEl = document.getElementById('val-stone');

    // Gelen olayın ismine göre UI'ı güncelle
    switch (eventName) {
      case 'MatchStatsSnapshot':
        if (statusEl) statusEl.innerText = "Maç Devam Ediyor ⚔️";
        // Oyundan gelen veriyi ekrana yaz, veri yoksa o anki değeri koru
        if (scoreEl && attributes.TotalScore !== undefined) scoreEl.innerText = attributes.TotalScore;
        if (woodEl && attributes.WoodCollected !== undefined) woodEl.innerText = attributes.WoodCollected;
        if (foodEl && attributes.FoodCollected !== undefined) foodEl.innerText = attributes.FoodCollected;
        if (goldEl && attributes.GoldCollected !== undefined) goldEl.innerText = attributes.GoldCollected;
        if (stoneEl && attributes.StoneCollected !== undefined) stoneEl.innerText = attributes.StoneCollected;
        break;

      case 'AgeAdvancement':
        if (statusEl) {
          statusEl.innerText = `Çağ Atlandı! 🚀`;
          statusEl.style.color = "#2ecc71"; // Yeşil yap
          
          // 5 saniye sonra tekrar normal durum yazısına dönsün
          setTimeout(() => {
            statusEl.innerText = "Maç Devam Ediyor ⚔️";
            statusEl.style.color = "#bdc3c7";
          }, 5000);
        }
        break;

      case 'ELOUpdate':
        if (statusEl) {
          statusEl.innerText = "Maç Bitti 🏁";
          statusEl.style.color = "#e74c3c"; // Kırmızı yap
        }
        break;
    }
  }

  // Oyun içi bilgiler (Oyuncular, Civler, Harita vb.) güncellendiğinde tetiklenir
  private onInfoUpdates(info) {
    console.log("Bilgi Güncellemesi:", info);
    this.logLine(this._infoLog, info, false);
  }

  // Önemli anlık olaylar (Ölüm, Maç Sonu vb.) tetiklenir
  private onNewEvents(e) {
    const shouldHighlight = e.events.some(event => {
      switch (event.name) {
        case 'kill':
        case 'death':
        case 'match_start': 
        case 'matchStart':  
        case 'match_end':
        case 'matchEnd':
        case 'victory':
        case 'defeat':
          return true;
        default:
          return false;
      }
    });
    
    this.logLine(this._eventsLog, e, shouldHighlight);
  }

  private async setToggleHotkeyText() {
    const gameClassId = await this.getCurrentGameClassId();
    const hotkeyText = await OWHotkeys.getHotkeyText(kHotkeys.toggle, gameClassId);
    const hotkeyElem = document.getElementById('hotkey');
    if (hotkeyElem) hotkeyElem.textContent = hotkeyText;
  }

  private async setToggleHotkeyBehavior() {
    const toggleInGameWindow = async (
      hotkeyResult: overwolf.settings.hotkeys.OnPressedEvent
    ): Promise<void> => {
      const inGameState = await this.getWindowState();

      if (inGameState.window_state === WindowState.NORMAL ||
        inGameState.window_state === WindowState.MAXIMIZED) {
        this.currWindow.minimize();
      } else {
        this.currWindow.restore();
      }
    }

    OWHotkeys.onHotkeyDown(kHotkeys.toggle, toggleInGameWindow);
  }

  private logLine(log: HTMLElement, data, highlight) {
    if (!log) return;

    const line = document.createElement('pre');
    line.textContent = JSON.stringify(data, null, 2); 

    if (highlight) {
      line.className = 'highlight';
    }

    const shouldAutoScroll = log.scrollTop + log.offsetHeight >= log.scrollHeight - 10;
    log.appendChild(line);

    if (shouldAutoScroll) {
      log.scrollTop = log.scrollHeight;
    }
  }

  private async getCurrentGameClassId(): Promise<number | null> {
    const info = await OWGames.getRunningGameInfo();
    return (info && info.isRunning && info.classId) ? info.classId : null;
  }
}

// Uygulamayı başlat
InGame.instance().run();