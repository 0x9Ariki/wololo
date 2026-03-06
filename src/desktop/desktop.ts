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
        this.fetchEloStats(savedAoe2Id);
        this.fetchMatchHistory(savedAoe2Id);
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
            this.fetchAoe2ProfileId(steamId);
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
        this.fetchEloStats(aoe2Id);
        this.fetchMatchHistory(aoe2Id);
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

  // --- 4. ELO VE DERECE İSTATİSTİKLERİNİ ÇEKEN FONKSİYON ---
  private async fetchEloStats(aoe2Id: string) {
    try {
      // "4" ID'si genellikle 1v1 RM (Rastgele Harita) modunu temsil eder
      const targetUrl = `https://www.aoe2insights.com/user/${aoe2Id}/elo-history/4/`;
      const response = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`);

      if (!response.ok) throw new Error("Elo verilerine ulaşılamadı.");

      const eloData = await response.json();

      // Eğer veri boşsa (oyuncu hiç 1v1 dereceli atmamışsa)
      if (!eloData || eloData.length === 0) {
        this.updateRankUI("unranked", "Derecesiz (Unranked)", "Elo: Yok");
        return;
      }

      // Dizinin EN SONUNDAKİ elemanı alıyoruz (Güncel Elo)
      const lastRecord = eloData[eloData.length - 1];
      const currentElo = lastRecord.y;

      // Elo'ya göre rank belirleme mantığı (Sayıları kendine göre ayarlayabilirsin)
      let rankIcon = "unranked";
      let rankName = "Deneyimsiz - Yeni Başlayan";

      if (currentElo > 0 && currentElo < 900) {
        rankIcon = "wood";
        rankName = "Wood";
      } else if (currentElo >= 900 && currentElo < 1100) {
        rankIcon = "silver";
        rankName = "Silver";
      } else if (currentElo >= 1100 && currentElo < 1300) {
        rankIcon = "gold";
        rankName = "Gold";
      } else if (currentElo >= 1300 && currentElo < 1500) {
        rankIcon = "plat";
        rankName = "Platinum";
      } else if (currentElo >= 1500 && currentElo < 1700) {
        rankIcon = "diamond";
        rankName = "Diamond";
      } else if (currentElo >= 1700) {
        rankIcon = "cha";
        rankName = "Challenger";
      }

      // Bulduğumuz verileri arayüze basıyoruz
      this.updateRankUI(rankIcon, rankName, `Elo: ${currentElo}`);

    } catch (error) {
      console.error("Elo verisi çekilirken hata:", error);
      this.updateRankUI("unranked", "Veri Alınamadı", "Elo: ?");
    }
  }

  // Arayüzdeki resim ve metinleri güncelleyen yardımcı fonksiyon
  private updateRankUI(icon: string, name: string, eloText: string) {
    const rankImgEl = document.getElementById("rankImage") as HTMLImageElement;
    const rankNameEl = document.getElementById("rankedName");
    const eloValueEl = document.getElementById("eloValue");

    // Resmin kaynağını dinamik olarak belirliyoruz (örn: silver -> silver.webp)
    if (rankImgEl) rankImgEl.src = `../../img/ranks/${icon}.webp`;
    if (rankNameEl) rankNameEl.innerText = name;
    if (eloValueEl) eloValueEl.innerText = eloText;
  }

  // --- 5. MAÇ GEÇMİŞİNİ ÇEKEN VE TAKIMLARI PARÇALAYAN FONKSİYON ---
  private async fetchMatchHistory(aoe2Id: string) {
    try {
      const targetUrl = `https://www.aoe2insights.com/user/${aoe2Id}/`;
      const response = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`);

      if (!response.ok) throw new Error("Maç geçmişi sayfasına ulaşılamadı.");

      const htmlText = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, "text/html");

      const container = document.getElementById("matchHistoryContainer");
      if (!container) return;

      const matchTiles = doc.querySelectorAll(".match-tile");
      if (matchTiles.length === 0) {
        container.innerHTML = "<p style='text-align:center; color:#ccc;'>Maç geçmişi bulunamadı.</p>";
        return;
      }

      container.innerHTML = "";

      // Son 5 maçı gösteriyoruz
      const recentMatches = Array.from(matchTiles).slice(0, 5);

      recentMatches.forEach(tile => {
        // Harita Adı ve Süre
        const mapEl = tile.querySelector(".match-map");
        const mapName = mapEl ? mapEl.textContent?.trim() : "Bilinmeyen Harita";

        const clockIcon = tile.querySelector(".fa-clock");
        const duration = clockIcon?.parentElement ? clockIcon.parentElement.textContent?.trim() : "";

        // Takımları Ayrıştırma Mantığı
        const teamNodes = tile.querySelectorAll(".team");
        let myTeam: any = null;
        let enemyTeams: any[] = [];
        let isWin = false;

        // Her bir takımı döngüye sok
        teamNodes.forEach(teamNode => {
          let isMyTeam = false;
          let hasWon = teamNode.classList.contains("won");
          let playersData: any[] = [];

          // Takımdaki her bir oyuncuyu döngüye sok
          const playerNodes = teamNode.querySelectorAll("li");
          playerNodes.forEach(pNode => {
            const userLinkEl = pNode.querySelector(".user-link a");
            const playerName = userLinkEl ? userLinkEl.textContent?.trim() : "Bilinmiyor";
            const playerHref = userLinkEl ? userLinkEl.getAttribute("href") : "";

            const civIconEl = pNode.querySelector(".image-icon");
            const civName = civIconEl ? (civIconEl.getAttribute("title") || "Bilinmiyor") : "Bilinmiyor";
            const civIconStr = civName.toLowerCase().replace(/ /g, "_"); // Boşlukları alt çizgi yap (örn: Teutons)

            // Bu oyuncu biz miyiz?
            const isMe = playerHref && playerHref.includes(`/user/${aoe2Id}/`);
            if (isMe) {
              isMyTeam = true;
              isWin = hasWon; // Bizim takım kazandıysa maçı kazanmışızdır
            }

            playersData.push({ name: playerName, civName, civIconStr, isMe });
          });

          const teamObj = { hasWon, playersData };

          // Bizim takım mı yoksa rakip mi ayır
          if (isMyTeam) {
            myTeam = teamObj;
          } else {
            enemyTeams.push(teamObj);
          }
        });

        const resultColor = isWin ? "#2ecc71" : "#e74c3c";
        const resultText = isWin ? "Galibiyet" : "Mağlubiyet";

        // Oyuncuları HTML'e dönüştüren yardımcı fonksiyon (Küçük, yan yana)
        const renderPlayers = (players: any[]) => {
          return players.map(p => `
                <div style="display: flex; align-items: center; margin-bottom: 3px;">
                    <img src="../../img/civs/${p.civIconStr}.webp" title="${p.civName}" style="width: 18px; height: 18px; border-radius: 2px; margin-right: 5px;">
                    <span style="font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px; color: ${p.isMe ? '#f1c40f' : '#dcdde1'}; font-weight: ${p.isMe ? 'bold' : 'normal'};">
                        ${p.name}
                    </span>
                </div>
            `).join("");
        };

        const myTeamHtml = myTeam ? renderPlayers(myTeam.playersData) : "";

        // Eğer 3lü veya 4lü FFA maçları varsa rakipleri alt alta birleştirir
        const enemyHtml = enemyTeams.map(t => renderPlayers(t.playersData)).join('<div style="height:1px; background:rgba(255,255,255,0.1); margin:3px 0;"></div>');

        // Yeni Gelişmiş Kompakt Kart Tasarımı
        const matchHtml = `
          <div style="background: rgba(15, 20, 25, 0.7); border-left: 4px solid ${resultColor}; padding: 8px; margin-bottom: 8px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">
             
             <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; margin-bottom: 6px;">
                 <span style="font-weight: bold; font-size: 12px; color: #fff;">${mapName}</span>
                 <span style="font-weight: bold; font-size: 12px; color: ${resultColor};">${resultText}</span>
                 <span style="font-size: 10px; color: #888;">${duration}</span>
             </div>
             
             <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                 
                 <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 9px; color: #7f8c8d; margin-bottom: 3px; text-transform: uppercase;">Bizim Takım</div>
                    ${myTeamHtml}
                 </div>
                 
                 <div style="font-size: 10px; font-weight: bold; color: #555; padding: 0 5px; align-self: center;">VS</div>
                 
                 <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 9px; color: #7f8c8d; margin-bottom: 3px; text-transform: uppercase;">Rakip</div>
                    ${enemyHtml}
                 </div>
                 
             </div>
          </div>
        `;

        container.innerHTML += matchHtml;
      });

    } catch (error) {
      console.error("Maç geçmişi çekilirken hata:", error);
      const container = document.getElementById("matchHistoryContainer");
      if (container) container.innerHTML = "<p style='color:red;'>Geçmiş yüklenemedi.</p>";
    }
  }
}

// Masaüstü penceresi yüklendiğinde sınıfı çalıştır
new DesktopMenu();