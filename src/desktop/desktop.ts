import { AppWindow } from "../AppWindow";
import { kWindowNames } from "../consts";

// Masaüstü penceresi genel başlatıcısı
new AppWindow(kWindowNames.desktop);

export class DesktopMenu {
  private logPath = "C:/Users/scray/Games/Age of Empires 2 DE/telemetry/TelemetryEventsHighPriority.json";

  constructor() {
    this.initProfile();
  }

  // Profil başlatma mantığı
  private initProfile() {
    const savedSteamId = localStorage.getItem("aoe2_steam_id");
    const savedAoe2Id = localStorage.getItem("aoe2_profile_id");

    if (savedSteamId) {
      console.log("Hafızadan Steam ID bulundu:", savedSteamId);
      this.fetchSteamProfile(savedSteamId);
      
      // Eğer AoE2 ID'si de daha önce kaydedilmişse direkt civ verilerini çek
      if (savedAoe2Id) {
         this.fetchCivStats(savedAoe2Id);
      } else {
         this.fetchAoe2ProfileId(savedSteamId);
      }
    }

    // Her halükarda log dosyasını tarayıp ID'yi güncellemeye çalışıyoruz
    this.scanLogForSteamId();
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

  // Steam XML Profilini Çekme (AllOrigins Proxy ile)
  private async fetchSteamProfile(steamId: string) {
    try {
      const targetUrl = encodeURIComponent(`https://steamcommunity.com/profiles/${steamId}/?xml=1`);
      const response = await fetch(`https://api.allorigins.win/get?url=${targetUrl}`);
      
      if (!response.ok) throw new Error("Steam profiline ulaşılamadı.");
      
      const data = await response.json();
      const xmlText = data.contents;
      
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

  // Steam ID'den aoe2insights Profile ID'sini çıkarma
  private async fetchAoe2ProfileId(steamId: string) {
    try {
      const searchUrl = encodeURIComponent(`https://www.aoe2insights.com/search/?q=${steamId}`);
      const response = await fetch(`https://api.allorigins.win/get?url=${searchUrl}`);
      
      if (!response.ok) throw new Error("AoE2Insights araması başarısız.");
      
      const data = await response.json();
      const match = data.contents.match(/\/user\/(\d+)\//);
      
      if (match && match[1]) {
        const aoe2Id = match[1];
        console.log("AoE2 ID bulundu ve kaydedildi:", aoe2Id);
        localStorage.setItem("aoe2_profile_id", aoe2Id);
        
        // ID'yi bulur bulmaz medeniyet istatistiklerini de çekiyoruz!
        this.fetchCivStats(aoe2Id);
      }
    } catch (error) {
      console.error("AoE2 ID çekilirken hata:", error);
    }
  }

  // YENİ: JSON verisini alıp HTML'e kart olarak basan fonksiyon
  private async fetchCivStats(aoe2Id: string) {
    try {
      // JSON verisini döndüren hedefin URL'si
      const targetUrl = encodeURIComponent(`https://www.aoe2insights.com/user/${aoe2Id}/civ-stats/`);
      
      // CORS sorununu aşmak için yine proxy kullanıyoruz
      const response = await fetch(`https://api.allorigins.win/get?url=${targetUrl}`);
      
      if (!response.ok) throw new Error("Medeniyet verilerine ulaşılamadı.");
      
      const data = await response.json();
      
      // Proxy bize içeriği string olarak veriyor, bunu tekrar JSON objesine (Diziye) çeviriyoruz
      const civArray = JSON.parse(data.contents);

      const container = document.getElementById("civStatsContainer");
      if (!container) return;

      // Konteynerin içindeki "Yükleniyor..." yazısını temizle
      container.innerHTML = "";

      // Gelen diziyi döngüye sokup her bir medeniyet için bir HTML bloku oluşturuyoruz
      // Sadece en çok oynanan 5 tanesini (veya hepsini istersen slice'ı kaldırabilirsin) listeleyelim
      const topCivs = civArray.slice(0, 5);

      topCivs.forEach((civ: any) => {
        // Senin CSS/Tasarım yapına uygun div oluşturuluyor
        const civCardHtml = `
          <div class="civCard" style="display: flex; align-items: center; margin-bottom: 8px;">
            <img src="../../img/civs/${civ.icon}.webp" alt="${civ.name}" height="64" width="64">
            
            <div class="civAlt" style="margin-left: 12px;">
              <p class="civName" style="margin: 0; font-weight: bold;">${civ.name}</p>
              <p class="civMatchCount" style="margin: 0; font-size: 14px; color: #a0a0a0;">Maç: ${civ.count}</p>
            </div>
          </div>
        `;
        
        // Oluşturulan HTML blokunu ana konteynerin içine ekle
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