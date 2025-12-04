export class Notification {
    constructor() {
        this.containerId = 'notification-container';
        this.initContainer();
    }

    initContainer() {
        let container = document.getElementById(this.containerId);

        // Classes para centralizar no topo da tela (z-50 garante que fique sobre tudo)
        const classes = 'fixed top-4 left-1/2 transform -translate-x-1/2 z-50 space-y-3 pointer-events-none min-w-[300px] text-center';

        if (!container) {
            container = document.createElement('div');
            container.id = this.containerId;
            document.body.appendChild(container);
        }

        // Garante que as classes de posicionamento estejam corretas
        container.className = classes;
        this.container = container;
    }

    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        // slide-in-top será animado via CSS ou Tailwind
        notification.className = `notification slide-in-top ${type} pointer-events-auto mx-auto shadow-xl border-l-4`;

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const styles = {
            success: 'bg-white border-success text-gray-800',
            error: 'bg-white border-error text-gray-800',
            warning: 'bg-white border-warning text-gray-800',
            info: 'bg-white border-primary text-gray-800'
        };
        
        const iconColor = {
            success: 'text-success',
            error: 'text-error',
            warning: 'text-warning',
            info: 'text-primary'
        };

        notification.innerHTML = `
            <div class="${styles[type]} px-6 py-4 rounded-r-lg flex items-center gap-4 min-w-[320px] max-w-md">
                <i class="fas ${icons[type]} ${iconColor[type]} text-2xl"></i>
                <div class="flex-1 text-left">
                    <p class="font-medium text-sm">${message}</p>
                </div>
                <button class="close-btn text-gray-400 hover:text-gray-600 transition-colors">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        this.container.appendChild(notification);

        const closeBtn = notification.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => this.remove(notification));

        if (duration > 0) {
            setTimeout(() => this.remove(notification), duration);
        }

        return notification;
    }

    remove(notification) {
        notification.style.transition = 'all 0.3s ease-out';
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => notification.remove(), 300);
    }

    success(msg, dur) { return this.show(msg, 'success', dur); }
    error(msg, dur) { return this.show(msg, 'error', dur); }
    warning(msg, dur) { return this.show(msg, 'warning', dur); }
    info(msg, dur) { return this.show(msg, 'info', dur); }
}

export default new Notification();