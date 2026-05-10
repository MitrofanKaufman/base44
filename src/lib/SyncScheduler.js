import WildberriesSync from './WildberriesSync';

/**
 * Планировщик автоматической синхронизации
 * Запускает синхронизацию по расписанию
 */
export class SyncScheduler {
  static instance = null;
  static intervalId = null;
  static syncInProgress = false;

  /**
   * Инициализировать планировщик
   * @param {number} intervalMinutes - Интервал синхронизации в минутах (default: 30)
   */
  static init(intervalMinutes = 30) {
    if (this.instance) {
      console.log('⚠️ SyncScheduler уже инициализирован');
      return;
    }

    this.instance = this;
    this.intervalMinutes = intervalMinutes;

    console.log(`🕐 SyncScheduler инициализирован с интервалом ${intervalMinutes} мин`);

    // Первая синхронизация сразу
    this.runSync();

    // Повторная синхронизация по расписанию
    this.intervalId = setInterval(() => {
      this.runSync();
    }, intervalMinutes * 60 * 1000);

    return this.instance;
  }

  /**
   * Запустить синхронизацию (с блокировкой одновременного запуска)
   */
  static async runSync() {
    if (this.syncInProgress) {
      console.log('⏳ Синхронизация уже в процессе, пропускаем...');
      return;
    }

    this.syncInProgress = true;

    try {
      const result = await WildberriesSync.syncAll();
      console.log('✅ Синхронизация завершена:', result);
      
      // Логируем в localStorage для отладки
      const logs = JSON.parse(localStorage.getItem('sync_logs') || '[]');
      logs.push({
        timestamp: new Date().toISOString(),
        result,
      });
      
      // Храним только последние 50 записей
      localStorage.setItem('sync_logs', JSON.stringify(logs.slice(-50)));
    } catch (error) {
      console.error('❌ Ошибка синхронизации:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Остановить планировщик
   */
  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 SyncScheduler остановлен');
    }
  }

  /**
   * Изменить интервал синхронизации
   */
  static setInterval(intervalMinutes) {
    this.intervalMinutes = intervalMinutes;
    this.stop();
    this.init(intervalMinutes);
    console.log(`⚙️ Интервал синхронизации изменён на ${intervalMinutes} мин`);
  }

  /**
   * Получить логи синхронизации
   */
  static getLogs() {
    return JSON.parse(localStorage.getItem('sync_logs') || '[]');
  }

  /**
   * Очистить логи
   */
  static clearLogs() {
    localStorage.removeItem('sync_logs');
    console.log('🧹 Логи синхронизации очищены');
  }

  /**
   * Получить статус текущей синхронизации
   */
  static getStatus() {
    return {
      initialized: !!this.instance,
      inProgress: this.syncInProgress,
      intervalMinutes: this.intervalMinutes,
      logs: this.getLogs(),
    };
  }
}

export default SyncScheduler;