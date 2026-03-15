import { AppWindow } from "../AppWindow";
import { kWindowNames } from "../consts";

// Masaüstü penceresi genel başlatıcısı
new AppWindow(kWindowNames.desktop);

export class DesktopMenu {
  private logPath = "C:/Users/scray/Games/Age of Empires 2 DE/telemetry/TelemetryEventsHighPriority.json";

  constructor() {
    this.setupNavigation(); // Yeni eklenen sekme değiştirme motoru
    this.initProfile();
  }

  // Sekmeler arası YUMUŞAK GEÇİŞİ (Fade In/Out) sağlayan sistem
  private setupNavigation() {
    const navHome = document.getElementById("nav-home");
    const navCiv = document.getElementById("nav-civ");
    const navLeaderboard = document.getElementById("nav-leaderboard");

    const viewHome = document.getElementById("view-home");
    const viewCiv = document.getElementById("view-civ");
    const viewLeaderboard = document.getElementById("view-leaderboard");

    const navItems = [navHome, navCiv, navLeaderboard];
    const views = [viewHome, viewCiv, viewLeaderboard];

    // İlk açılışta ana sayfanın görünürlüğünü garantiye al
    if (viewHome) {
        viewHome.style.display = "block";
        viewHome.style.opacity = "1";
    }

    const switchView = (targetNav: HTMLElement | null, targetView: HTMLElement | null) => {
      // Eğer tıklanan sekme zaten açıksa veya elementler yoksa hiçbir şey yapma
      if (!targetNav || !targetView || targetNav.classList.contains("active")) return;

      // Üst menüdeki mavi çizgiyi anında yeni sekmeye geçir
      navItems.forEach(nav => nav?.classList.remove("active"));
      targetNav.classList.add("active");

      // Şu an ekranda açık olan (display: block olan) sekmeyi bul
      const currentView = views.find(view => view && view.style.display === "block");

      if (currentView) {
        // 1. Adım: Önce açık olan sekmeyi yavaşça karart (Fade Out)
        currentView.style.opacity = "0";

        // 2. Adım: Kararma animasyonu bitene kadar bekle (200ms)
        setTimeout(() => {
          currentView.style.display = "none"; // Ekranda yer kaplamasını engelle
          targetView.style.display = "block"; // Yeni sekmeyi yerleştir (ama hala şeffaf)

          // 3. Adım: Tarayıcının yeni düzeni çizmesi için çok kısa bir süre bekle ve sonra yavaşça aydınlat (Fade In)
          setTimeout(() => {
            targetView.style.opacity = "1";
          }, 20); // 20ms'lik bu gecikme, tarayıcının animasyonu atlamasını engeller
        }, 200); // Bu süre CSS'deki transition süresiyle (0.2s) eşleşmelidir
      }
    };

    // Butonlara tıklama (click) olaylarını bağla
    navHome?.addEventListener("click", () => switchView(navHome, viewHome));
    navCiv?.addEventListener("click", () => switchView(navCiv, viewCiv));
    navLeaderboard?.addEventListener("click", () => switchView(navLeaderboard, viewLeaderboard));
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

// --- 3. MEDENİYET İSTATİSTİKLERİNİ ÇEKEN FONKSİYON (Resmi API ile) ---
  private async fetchCivStats(aoe2Id: string) {
    try {
      // Proxy kullanmadan doğrudan resmi API'ye bağlanıyoruz
      const targetUrl = `https://data.aoe2companion.com/api/profiles/${aoe2Id}?extend=stats`;
      const response = await fetch(targetUrl);

      if (!response.ok) throw new Error("Medeniyet verilerine ulaşılamadı.");

      const data = await response.json();

      const container = document.getElementById("civStatsContainer");
      if (!container) return;

      container.innerHTML = "";

      // Tüm oyun modlarındaki civ oynanma sayılarını toplayacağımız bir harita (Map) oluşturuyoruz
      const civStatsMap = new Map<string, { name: string, icon: string, count: number }>();

      if (data && data.stats) {
        // Her bir oyun modunu (leaderboard) dön
        data.stats.forEach((leaderboard: any) => {
          if (leaderboard.civ && Array.isArray(leaderboard.civ)) {
            // O moddaki her bir medeniyeti dön
            leaderboard.civ.forEach((civData: any) => {
              const civKey = civData.civ; // örn: "huns"
              
              // Eğer bu medeniyeti haritaya henüz eklemediysek, sıfırdan ekle
              if (!civStatsMap.has(civKey)) {
                civStatsMap.set(civKey, {
                  name: civData.civName,
                  icon: civKey, // API zaten küçük harfli resim formatını veriyor (huns, turks)
                  count: 0
                });
              }
              
              // Oynanma sayısını (games) mevcut sayının üzerine ekle
              civStatsMap.get(civKey)!.count += civData.games;
            });
          }
        });
      }

      // Haritayı diziye çevir, oynanma sayısına (count) göre büyükten küçüğe sırala
      const sortedCivs = Array.from(civStatsMap.values()).sort((a, b) => b.count - a.count);
      
      // En çok oynanan ilk 5 medeniyeti al
      const topCivs = sortedCivs.slice(0, 5);

      if (topCivs.length === 0) {
         container.innerHTML = "<p style='color:gray; text-align:center; margin-top:10px;'>Medeniyet verisi bulunamadı.</p>";
         return;
      }

      // Verileri senin orjinal tasarımına uygun şekilde HTML'e bas
      topCivs.forEach((civ: any) => {
        const civCardHtml = `
          <div class="civCard" style="display: flex; align-items: center; margin-bottom: 8px;">
            <img src="../../img/civs/${civ.icon}.webp" alt="${civ.name}" height="64" width="64" onerror="this.src='../../img/civs/unknown.webp'">
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

// --- 4. ELO VE DERECE İSTATİSTİKLERİNİ ÇEKEN FONKSİYON (Resmi API ile) ---
  private async fetchEloStats(aoe2Id: string) {
    try {
      // Doğrudan profil API'sine istek atıyoruz (Proxy YOK!)
      const targetUrl = `https://data.aoe2companion.com/api/profiles/${aoe2Id}`;
      const response = await fetch(targetUrl);

      if (!response.ok) throw new Error("Elo verilerine ulaşılamadı.");

      const data = await response.json();

      // Eğer "leaderboards" dizisi boşsa (oyuncu hiç dereceli atmamışsa)
      if (!data || !data.leaderboards || data.leaderboards.length === 0) {
        this.updateRankUI("unranked", "Derecesiz (Unranked)", "Elo: Yok");
        return;
      }

      // Şimdilik listedeki İLK elemanı (en üsttekini) alıyoruz
      const firstLeaderboard = data.leaderboards[0];
      const currentElo = firstLeaderboard.rating;
      
      // Oyuncunun hangi modda bu eloya sahip olduğunu da gösterelim (örn: "RM Team")
      const modeName = firstLeaderboard.abbreviation || "Dereceli";

      // Elo'ya göre rank belirleme mantığı
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

      // Bulduğumuz verileri arayüze basıyoruz (Parantez içinde oyun modunu da yazdırdım)
      this.updateRankUI(rankIcon, `${rankName} (${modeName})`, `Elo: ${currentElo}`);

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

// --- 5. MAÇ GEÇMİŞİNİ ÇEKEN VE TAKIMLARI PARÇALAYAN FONKSİYON (Resmi API ile) ---
  private async fetchMatchHistory(aoe2Id: string) {
    try {
      // 5 maçı getiren, proxy gerektirmeyen yeni ve süper hızlı JSON bağlantımız
      const url = `https://data.aoe2companion.com/api/matches?profile_ids=${aoe2Id}&use_enums=true&page=1&per_page=5`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error("Maç geçmişi API'sine ulaşılamadı.");

      // Veriyi doğrudan JSON olarak açıyoruz
      const json = await response.json();
      const matches = json.matches; // Maç dizimiz

      const container = document.getElementById("matchHistoryContainer");
      if (!container) return;

      if (!matches || matches.length === 0) {
        container.innerHTML = "<p style='text-align:center; color:#ccc;'>Maç geçmişi bulunamadı.</p>";
        return;
      }

      container.innerHTML = ""; // Yükleniyor yazısını temizle

      matches.forEach((match: any) => {
        // Harita Adı
        const mapName = match.mapName || "Bilinmeyen Harita";

        // Maç süresini hesaplama (Bitiş zamanından başlangıç zamanını çıkarıyoruz)
        let durationStr = "Süre Yok";
        if (match.started && match.finished) {
          const startMs = new Date(match.started).getTime();
          const endMs = new Date(match.finished).getTime();
          const diffMs = endMs - startMs;
          
          const diffMins = Math.floor(diffMs / 60000);
          const diffSecs = Math.floor((diffMs % 60000) / 1000);
          durationStr = `${diffMins}m ${diffSecs}s`;
        } else if (match.started && !match.finished) {
          durationStr = "Devam Ediyor"; // Eğer maç hala bitmediyse
        }

        let myTeam: any[] = [];
        let enemyTeams: any[] = [];
        let isWin = false;
        let myTeamId = -1;

        // 1. ADIM: Hangi takımda olduğumuzu bulalım
        if (match.teams) {
           match.teams.forEach((team: any) => {
              team.players.forEach((p: any) => {
                 if (p.profileId && p.profileId.toString() === aoe2Id) {
                    myTeamId = team.teamId;
                    isWin = (p.won === true); // Kazanma durumu
                 }
              });
           });

           // 2. ADIM: Tüm oyuncuları kendi takımımıza ve rakip takıma yerleştirelim
           match.teams.forEach((team: any) => {
              const teamPlayers: any[] = [];
              team.players.forEach((p: any) => {
                  const civName = p.civName || "Bilinmiyor";
                  // API bize civ değerini "bohemians", "huns" gibi resim isimlerine tam uygun verir!
                  const civIconStr = p.civ || "unknown"; 
                  const isMe = (p.profileId && p.profileId.toString() === aoe2Id);
                  const playerName = p.name || "Bilinmiyor";

                  teamPlayers.push({ name: playerName, civName, civIconStr, isMe });
              });

              if (team.teamId === myTeamId) {
                  // Kendi takımımızı tek bir listeye koyuyoruz
                  myTeam.push(...teamPlayers);
              } else {
                  // Rakip takımları ayrı bir dizi olarak ekliyoruz (FFA maçlar için önemli)
                  enemyTeams.push(teamPlayers);
              }
           });
        }

        // Tasarımı duruma göre ayarla
        const resultColor = isWin ? "#2ecc71" : "#e74c3c";
        const resultText = isWin ? "Galibiyet" : "Mağlubiyet";

        // Oyuncuları HTML'e dönüştüren yardımcı fonksiyon (Küçük, yan yana)
        const renderPlayers = (players: any[]) => {
          return players.map(p => `
                <div style="display: flex; align-items: center; margin-bottom: 3px;">
                    <img src="../../img/civs/${p.civIconStr}.webp" title="${p.civName}" style="width: 18px; height: 18px; border-radius: 2px; margin-right: 5px;" onerror="this.src='../../img/civs/unknown.webp'">
                    <span style="font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px; color: ${p.isMe ? '#f1c40f' : '#dcdde1'}; font-weight: ${p.isMe ? 'bold' : 'normal'};">
                        ${p.name}
                    </span>
                </div>
            `).join("");
        };

        const myTeamHtml = renderPlayers(myTeam);
        // Eğer 3lü veya 4lü FFA maçları varsa rakipleri alt alta birleştirir (Araya çizgi atar)
        const enemyHtml = enemyTeams.map(teamPlayers => renderPlayers(teamPlayers)).join('<div style="height:1px; background:rgba(255,255,255,0.1); margin:3px 0;"></div>');

        // Yeni Gelişmiş Kompakt Kart Tasarımı
        const matchHtml = `
          <div style="background: rgba(15, 20, 25, 0.7); border-left: 4px solid ${resultColor}; padding: 8px; margin-bottom: 8px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">
             
             <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; margin-bottom: 6px;">
                 <span style="font-weight: bold; font-size: 12px; color: #fff;">${mapName}</span>
                 <span style="font-weight: bold; font-size: 12px; color: ${resultColor};">${resultText}</span>
                 <span style="font-size: 10px; color: #888;">${durationStr}</span>
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