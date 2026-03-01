import type { SystemStats } from './system_service';

export interface SystemAlert {
    type: 'disk_space' | 'memory' | 'temperature'
    message: string
    severity: 'warning' | 'critical'
    value: number
    threshold: number
}

export function check_system_alerts(stats: SystemStats): SystemAlert[] {
    const alerts: SystemAlert[] = [];

    if (stats.storage_percent > 90) {
        alerts.push({
            type: 'disk_space',
            message: `Disk usage at ${stats.storage_percent}%`,
            severity: 'critical',
            value: stats.storage_percent,
            threshold: 90
        });
    }
    else if (stats.storage_percent > 80) {
        alerts.push({
            type: 'disk_space',
            message: `Disk usage at ${stats.storage_percent}%`,
            severity: 'warning',
            value: stats.storage_percent,
            threshold: 80
        });
    }

    if (stats.memory_percent > 95) {
        alerts.push({
            type: 'memory',
            message: `Memory usage at ${stats.memory_percent}%`,
            severity: 'critical',
            value: stats.memory_percent,
            threshold: 95
        });
    }
    else if (stats.memory_percent > 85) {
        alerts.push({
            type: 'memory',
            message: `Memory usage at ${stats.memory_percent}%`,
            severity: 'warning',
            value: stats.memory_percent,
            threshold: 85
        });
    }

    if (stats.cpu_temp_celsius !== null) {
        if (stats.cpu_temp_celsius > 80) {
            alerts.push({
                type: 'temperature',
                message: `CPU temperature at ${stats.cpu_temp_celsius}°C`,
                severity: 'critical',
                value: stats.cpu_temp_celsius,
                threshold: 80
            });
        }
        else if (stats.cpu_temp_celsius > 70) {
            alerts.push({
                type: 'temperature',
                message: `CPU temperature at ${stats.cpu_temp_celsius}°C`,
                severity: 'warning',
                value: stats.cpu_temp_celsius,
                threshold: 70
            });
        }
    }

    return alerts;
}
