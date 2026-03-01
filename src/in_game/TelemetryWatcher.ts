export class TelemetryWatcher {
    private normalLogPath: string;
    private lifecycleLogPath: string;
    private lastProcessedSequence: number = 0;
    private checkInterval: any;

    constructor() {
        // Senin bilgisayarındaki kesin yol (Ters slash'leri / yaptık ki JS hata vermesin)
        const basePath = "C:/Users/scray/Games/Age of Empires 2 DE/telemetry";

        this.normalLogPath = `${basePath}/TelemetryEventsNormalPriority.json`;
        this.lifecycleLogPath = `${basePath}/LifecycleTelemetryEvents.json`;
    }

    public startWatching(onEventCallback: (eventName: string, data: any) => void) {
        console.log("AoE 2 Telemetri takibi başlatıldı...");

        // Her 1.5 saniyede bir kontrol et (Çok sık yaparsak diski yorarız, 1.5 saniye idealdir)
        this.checkInterval = setInterval(() => {
            this.readLogFile(this.normalLogPath, onEventCallback);
        }, 1500);
    }

    public stopWatching() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            console.log("Telemetri takibi durduruldu.");
        }
    }

    private readLogFile(filePath: string, callback: (eventName: string, data: any) => void) {
        // file:/// kısmını sildik, Overwolf'a doğrudan düz dosya yolunu (C:/...) veriyoruz.
        const options: overwolf.io.ReadFileOptions = {
            encoding: overwolf.io.enums.eEncoding.UTF8,
            maxBytesToRead: 0,
            offset: 0
        };

        overwolf.io.readTextFile(filePath, options, (result) => {
            if (result.success && result.content) {
                this.parseLogContent(result.content, callback);
            } else {
                // Sessiz hataları yakalıyoruz! 
                // Eğer oyun henüz dosyayı oluşturmadığı için "file not found" diyorsa es geç,
                // ama erişim izni vb. başka bir hata varsa konsola kırmızıyla yazdır.
                if (result.error && !result.error.toLowerCase().includes("not found")) {
                    console.error(`[Dosya Okuma Hatası] Yol: ${filePath} | Hata:`, result.error);
                }
            }
        });
    }

    private parseLogContent(content: string, callback: (eventName: string, data: any) => void) {
        const lines = content.split('\n').filter(line => line.trim().length > 0);

        for (const line of lines) {
            try {
                const eventData = JSON.parse(line);

                if (eventData.attributes && eventData.attributes.PlayerSessionSequence !== undefined) {
                    const seq = eventData.attributes.PlayerSessionSequence;

                    if (seq > this.lastProcessedSequence) {
                        this.lastProcessedSequence = seq;

                        // Veri başarıyla çözülürse konsolda görelim!
                        console.log(`[Yeni Olay Çözüldü] -> ${eventData.name}`);
                        callback(eventData.name, eventData.attributes);
                    }
                }
            } catch (e) {
                // Parse hatalarını görelim
                console.warn("[JSON Parse Hatası] Oyun henüz dosyayı tam yazamamış olabilir.");
            }
        }
    }
}