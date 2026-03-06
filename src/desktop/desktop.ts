import { AppWindow } from "../AppWindow";
import { kWindowNames } from "../consts";

// Masaüstü penceresi genel başlatıcısı
new AppWindow(kWindowNames.desktop);

export class DesktopMenu {
  private logPath = "C:/Users/scray/Games/Age of Empires 2 DE/telemetry/TelemetryEventsHighPriority.json";

  constructor() {
    this.initProfile();
  }

  // SADELEŞTİRİLMİŞ BAŞLATMA MANTIĞI
  private initProfile() {
    // 1. TelemetryWatcher'ın oyun içindeyken kaydettiği ID'leri hafızadan al
    const savedSteamId = localStorage.getItem("aoe2_steam_id");
    const savedAoe2Id = localStorage.getItem("aoe2_profile_id");

    if (savedSteamId) {
      console.log("Hafızadan Steam ID bulundu, profil güncelleniyor...");
      // İsim veya resim değişmiş olabilir diye her açılışta Steam verisini tazele
      this.fetchSteamProfile(savedSteamId);

      if (savedAoe2Id) {
        // Harika! ID zaten biliniyor, arama yapma, DİREKT İSTATİSTİKLERİ ÇEK!
        console.log("AoE2 ID biliniyor, istatistikler çekiliyor...");
        this.fetchCivStats(savedAoe2Id);
      } else {
        // Sadece uygulama ilk kurulduğunda 1 kere çalışır
        console.log("AoE2 ID ilk kez aranıyor...");
        this.fetchAoe2ProfileId(savedSteamId);
      }
    } else {
      console.log("Henüz Steam ID bulunamadı. Lütfen oyuna bir kez giriş yapın.");
      const container = document.getElementById("civStatsContainer");
      if (container) container.innerHTML = "<p style='color:#f39c12;'>Verileri görmek için oyuna bir kez giriş yapmalısınız.</p>";
    }
  }

  // Log dosyasından Steam ID arama
  private scanLogForSteamId() {
    const options: overwolf.io.ReadFileOptions = {
      encoding: overwolf.io.enums.eEncoding.UTF8,
      maxBytesToRead: 0,
      offset: 0
    };

    overwolf.io.readTextFile(this.logPath, options, (result) => {
      if (result.success && result.content) {
        const match = result.content.match(/"UserId":"(\d+)"/);

        if (match && match[1]) {
          const steamId = match[1];
          const savedId = localStorage.getItem("aoe2_steam_id");

          if (steamId !== savedId) {
            console.log("Yeni Steam ID yakalandı:", steamId);
            localStorage.setItem("aoe2_steam_id", steamId);
            this.fetchSteamProfile(steamId);
            this.fetchAoe2ProfileId(steamId); // Yeni ID bulunduğunda AoE2 ID'sini de bul
          }
        }
      }
    });
  }

  // --- 1. STEAM PROFİLİNİ ÇEKEN FONKSİYON ---
  private async fetchSteamProfile(steamId: string) {
    try {
      const targetUrl = `https://steamcommunity.com/profiles/${steamId}/?xml=1`;
      // Yeni proxy'miz: codetabs
      const response = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`);

      if (!response.ok) throw new Error("Steam profiline ulaşılamadı.");

      // Codetabs veriyi bozmadan doğrudan RAW (saf) metin olarak verir, contents'e gerek yok!
      const xmlText = await response.text();

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");

      const steamName = xmlDoc.querySelector("steamID")?.textContent || "Gizli Profil";
      const avatarUrl = xmlDoc.querySelector("avatarFull")?.textContent || "";
      const location = xmlDoc.querySelector("location")?.textContent || "Konum Gizli";

      const nameEl = document.getElementById('profile-name');
      const avatarEl = document.getElementById('profile-avatar') as HTMLImageElement;
      const locationEl = document.getElementById('profile-location');

      if (nameEl) nameEl.innerText = steamName;
      if (avatarEl && avatarUrl) avatarEl.src = avatarUrl;
      if (locationEl) locationEl.innerText = location;

    } catch (error) {
      console.error("Steam verisi çekilirken hata:", error);
    }
  }

  // --- 2. AOE2 PROFILE ID BULUCU FONKSİYON ---
  private async fetchAoe2ProfileId(steamId: string) {
    try {
      const targetUrl = `https://www.aoe2insights.com/search/?q=${steamId}`;
      const response = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`);

      if (!response.ok) throw new Error("AoE2Insights araması başarısız.");

      // Doğrudan saf HTML geliyor
      const htmlContent = await response.text();
      const match = htmlContent.match(/\/user\/(\d+)\//);

      const insightsEl = document.getElementById('profile-insights-id');

      if (match && match[1]) {
        const aoe2Id = match[1];
        console.log("AoE2 Profile ID Başarıyla Söküldü:", aoe2Id);

        localStorage.setItem("aoe2_profile_id", aoe2Id);

        if (insightsEl) {
          insightsEl.innerText = `AoE2 ID: ${aoe2Id}`;
          insightsEl.style.color = "#2ecc71";
        }

        // Bulunca hemen medeniyet verilerini çek
        this.fetchCivStats(aoe2Id);
      } else {
        if (insightsEl) insightsEl.innerText = "AoE2 ID Bulunamadı";
      }
    } catch (error) {
      console.error("AoE2 ID çekilirken hata:", error);
    }
  }

  // --- 3. MEDENİYET İSTATİSTİKLERİNİ ÇEKEN FONKSİYON ---
  private async fetchCivStats(aoe2Id: string) {
    try {
      const targetUrl = `https://www.aoe2insights.com/user/${aoe2Id}/civ-stats/`;
      const response = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`);

      if (!response.ok) throw new Error("Medeniyet verilerine ulaşılamadı.");

      // Codetabs veriyi doğrudan JSON dizisi olarak verdiği için JSON.parse ile uğraşmıyoruz!
      const civArray = await response.json();

      const container = document.getElementById("civStatsContainer");
      if (!container) return;

      container.innerHTML = "";

      const topCivs = civArray.slice(0, 5);

      topCivs.forEach((civ: any) => {
        const civCardHtml = `
          <div class="civCard" style="display: flex; align-items: center; margin-bottom: 8px;">
            <img src="../../img/civs/${civ.icon}.webp" alt="${civ.name}" height="64" width="64">
            <div class="civAlt" style="margin-left: 12px;">
              <p class="civName" style="margin: 0; font-weight: bold;">${civ.name}</p>
              <p class="civMatchCount" style="margin: 0; font-size: 14px; color: #a0a0a0;">Maç: ${civ.count}</p>
            </div>
          </div>
        `;
        container.innerHTML += civCardHtml;
      });

    } catch (error) {
      console.error("Medeniyet istatistikleri işlenirken hata:", error);
      const container = document.getElementById("civStatsContainer");
      if (container) container.innerHTML = "<p style='color:red;'>Veriler yüklenemedi.</p>";
    }
  }
}

// Masaüstü penceresi yüklendiğinde sınıfı çalıştır
new DesktopMenu();