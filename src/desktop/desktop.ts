import { AppWindow } from "../AppWindow";
import { kWindowNames } from "../consts";

// The desktop window is the window displayed while game is not running.
// In our case, our desktop window has no logic - it only displays static data.
// Therefore, only the generic AppWindow class is called.
new AppWindow(kWindowNames.desktop);

export class DesktopMenu {
  private logPath = "C:/Users/scray/Games/Age of Empires 2 DE/telemetry/TelemetryEventsHighPriority.json";

  constructor() {
    this.initProfile();
  }

  // Profil başlatma mantığı
  private initProfile() {
    // Önce hafızada kayıtlı bir ID var mı diye bakıyoruz
    const savedSteamId = localStorage.getItem("aoe2_steam_id");

    if (savedSteamId) {
      console.log("Hafızadan Steam ID bulundu:", savedSteamId);
      this.fetchSteamProfile(savedSteamId);
    }

    // Her halükarda log dosyasını tarayıp ID'yi güncellemeye çalışıyoruz
    this.scanLogForSteamId();
  }

  // Log dosyasının içinden UserId değerini arayan fonksiyon
  private scanLogForSteamId() {
    const options: overwolf.io.ReadFileOptions = {
      encoding: overwolf.io.enums.eEncoding.UTF8,
      maxBytesToRead: 0,
      offset: 0
    };

    overwolf.io.readTextFile(this.logPath, options, (result) => {
      if (result.success && result.content) {
        // Dosyanın tamamını JSON'a çevirmek yerine Regex ile sadece UserId'yi buluyoruz.
        // Bu, bozuk JSON hatalarından (yarım yazılma) bizi kurtarır.
        const match = result.content.match(/"UserId":"(\d+)"/);

        if (match && match[1]) {
          const steamId = match[1];
          const savedId = localStorage.getItem("aoe2_steam_id");

          // Eğer yeni bir ID bulduysak veya ilk defa buluyorsak
          if (steamId !== savedId) {
            console.log("Yeni Steam ID yakalandı:", steamId);
            localStorage.setItem("aoe2_steam_id", steamId);
            this.fetchSteamProfile(steamId);
          }
        }
      }
    });
  }

  // Steam'in XML API'sine bağlanıp verileri çeken fonksiyon
  // Steam'in XML API'sine proxy üzerinden bağlanıp verileri çeken fonksiyon
// Steam'in XML API'sine JSON sarmallı proxy üzerinden bağlanıyoruz
  private async fetchSteamProfile(steamId: string) {
    try {
      const targetUrl = encodeURIComponent(`https://steamcommunity.com/profiles/${steamId}/?xml=1`);
      
      // /raw YERİNE /get KULLANIYORUZ
      // Bu sayede veri, Overwolf'un takılmayacağı güvenli bir JSON paketi içinde gelir
      const response = await fetch(`https://api.allorigins.win/get?url=${targetUrl}`);
      
      if (!response.ok) throw new Error("Steam profiline ulaşılamadı.");
      
      // Gelen yanıtı JSON olarak açıyoruz
      const data = await response.json();
      
      // Asıl XML metni "contents" objesinin içinde saklı
      const xmlText = data.contents;
      
      // Gelen metni XML DOM formatına çeviriyoruz
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");

      // XML içindeki etiketleri yakalıyoruz
      const steamName = xmlDoc.querySelector("steamID")?.textContent || "Gizli Profil";
      const avatarUrl = xmlDoc.querySelector("avatarFull")?.textContent || "";
      const location = xmlDoc.querySelector("location")?.textContent || "Konum Gizli";

      // Arayüzü (HTML) Güncelliyoruz
      const nameEl = document.getElementById('profile-name');
      const avatarEl = document.getElementById('profile-avatar') as HTMLImageElement;
      const locationEl = document.getElementById('profile-location');

      if (nameEl) nameEl.innerText = steamName;
      if (avatarEl && avatarUrl) avatarEl.src = avatarUrl;
      if (locationEl) locationEl.innerText = location;

    } catch (error) {
      console.error("Steam verisi çekilirken hata oluştu:", error);
    }
  }
}

// Masaüstü penceresi yüklendiğinde sınıfı çalıştır
new DesktopMenu();
