/**
 * Sistema de notificações toast
 */
export class Notification {
    constructor() {
        this.container = document.getElementById('notification-container');
    }

    /**
     * Mostra uma notificação
     * @param {string} message - Mensagem a ser exibida
     * @param {string} type - Tipo: 'success', 'error', 'warning', 'info'
     * @param {number} duration - Duração em ms (padrão: 5000)
     */
    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification slide-in ${type}`;

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const colors = {
            success: 'bg-success text-white',
            error: 'bg-error text-white',
            warning: 'bg-warning text-white',
            info: 'bg-primary text-white'
        };

        notification.innerHTML = `
      <div class="${colors[type]} px-6 py-4 rounded-lg shadow-lg flex items-center space-x-3 max-w-md">
        <i class="fas ${icons[type]} text-xl"></i>
        <span class="flex-1">${message}</span>
        <button class="close-btn hover:opacity-75 transition-opacity">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;

        this.container.appendChild(notification);

        // Fechar ao clicar no X
        const closeBtn = notification.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => this.remove(notification));

        // Auto-remover após duração
        if (duration > 0) {
            setTimeout(() => this.remove(notification), duration);
        }

        return notification;
    }

    /**
     * Remove uma notificação
     * @param {HTMLElement} notification - Elemento da notificação
     */
    remove(notification) {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }

    success(message, duration) {
        return this.show(message, 'success', duration);
    }

    error(message, duration) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration) {
        return this.show(message, 'info', duration);
    }
}

export default new Notification();
