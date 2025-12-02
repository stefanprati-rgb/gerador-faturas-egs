/**
 * Componente de barra de progresso
 */
export class ProgressBar {
    constructor() {
        this.overlay = document.getElementById('progress-overlay');
        this.bar = document.getElementById('progress-bar');
        this.status = document.getElementById('progress-status');
        this.detail = document.getElementById('progress-detail');
    }

    /**
     * Mostra a barra de progresso
     * @param {string} statusText - Texto do status
     * @param {string} detailText - Texto de detalhe
     */
    show(statusText = '', detailText = '') {
        if (this.overlay) {
            this.overlay.classList.remove('hidden');
            this.update(0, statusText, detailText);
        }
    }

    /**
     * Esconde a barra de progresso
     */
    hide() {
        if (this.overlay) {
            this.overlay.classList.add('hidden');
        }
    }

    /**
     * Atualiza o progresso
     * @param {number} percent - Porcentagem (0-100)
     * @param {string} statusText - Texto do status
     * @param {string} detailText - Texto de detalhe
     */
    update(percent, statusText = '', detailText = '') {
        if (this.bar) {
            this.bar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
        }

        if (this.status && statusText) {
            this.status.textContent = statusText;
        }

        if (this.detail && detailText) {
            this.detail.textContent = detailText;
        }
    }

    /**
     * Define progresso incremental
     * @param {number} current - Valor atual
     * @param {number} total - Valor total
     * @param {string} statusText - Texto do status
     */
    setProgress(current, total, statusText = '') {
        const percent = (current / total) * 100;
        const detail = `${current} de ${total}`;
        this.update(percent, statusText, detail);
    }
}

export default new ProgressBar();
