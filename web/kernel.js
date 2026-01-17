/**
 * NextPM Web Serial Kernel
 * v1.0.0-prod
 *
 * Manages Web Serial API communication with XIAO ESP32-S3 + NextPM sensor
 * Provides abstraction layer for both Pro and Light interfaces
 */

class NextPMKernel {
    constructor() {
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.isConnected = false;
        this.readBuffer = '';

        // Event listeners
        this.listeners = {
            'connect': [],
            'disconnect': [],
            'data': [],
            'error': [],
            'log': []
        };

        // Sensor info cache
        this.sensorInfo = {
            fwESP32: null,
            fwSensor: null,
            state: null,
            binsSupportest: false,
            lastUpdate: null
        };

        // Statistics
        this.stats = {
            commandsSent: 0,
            responsesReceived: 0,
            errors: 0,
            checksumFailures: 0
        };
    }

    /**
     * Register event listener
     */
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    /**
     * Emit event to all listeners
     */
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }

    /**
     * Log message (for debugging)
     */
    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data
        };
        this.emit('log', logEntry);

        // Console output
        const prefix = `[${timestamp}] [${level}]`;
        if (data) {
            console[level.toLowerCase()](prefix, message, data);
        } else {
            console[level.toLowerCase()](prefix, message);
        }
    }

    /**
     * Connect to serial port
     */
    async connect() {
        try {
            this.log('INFO', 'Requesting serial port...');

            // Request port from user
            this.port = await navigator.serial.requestPort();

            this.log('INFO', 'Opening serial port at 115200 baud...');

            // Open port with correct settings for ESP32
            await this.port.open({
                baudRate: 115200,
                dataBits: 8,
                stopBits: 1,
                parity: 'none',
                flowControl: 'none'
            });

            // Get reader and writer
            this.reader = this.port.readable.getReader();
            this.writer = this.port.writable.getWriter();

            this.isConnected = true;
            this.log('INFO', 'Connected successfully!');
            this.emit('connect', { success: true });

            // Start reading
            this.startReading();

            // Query initial sensor info
            setTimeout(() => this.querySensorInfo(), 500);

            return true;

        } catch (error) {
            this.log('ERROR', 'Connection failed', error);
            this.emit('error', { type: 'connection', error });
            return false;
        }
    }

    /**
     * Disconnect from serial port
     */
    async disconnect() {
        try {
            this.log('INFO', 'Disconnecting...');

            // Cancel reader
            if (this.reader) {
                await this.reader.cancel();
                this.reader.releaseLock();
                this.reader = null;
            }

            // Close writer
            if (this.writer) {
                this.writer.releaseLock();
                this.writer = null;
            }

            // Close port
            if (this.port) {
                await this.port.close();
                this.port = null;
            }

            this.isConnected = false;
            this.log('INFO', 'Disconnected');
            this.emit('disconnect', { success: true });

        } catch (error) {
            this.log('ERROR', 'Disconnection error', error);
            this.emit('error', { type: 'disconnection', error });
        }
    }

    /**
     * Start reading from serial port
     */
    async startReading() {
        try {
            while (this.isConnected && this.reader) {
                const { value, done } = await this.reader.read();

                if (done) {
                    this.log('WARN', 'Reader closed');
                    break;
                }

                // Decode incoming data
                const text = new TextDecoder().decode(value);
                this.readBuffer += text;

                // Process complete lines
                let newlineIndex;
                while ((newlineIndex = this.readBuffer.indexOf('\n')) !== -1) {
                    const line = this.readBuffer.substring(0, newlineIndex).trim();
                    this.readBuffer = this.readBuffer.substring(newlineIndex + 1);

                    if (line.length > 0) {
                        this.handleIncomingLine(line);
                    }
                }
            }
        } catch (error) {
            if (this.isConnected) {
                this.log('ERROR', 'Read error', error);
                this.emit('error', { type: 'read', error });
            }
        }
    }

    /**
     * Handle incoming line from serial
     */
    handleIncomingLine(line) {
        this.log('DEBUG', 'RX', line);

        try {
            // Try to parse as JSON
            const data = JSON.parse(line);
            this.stats.responsesReceived++;

            // Check for checksum failures
            if (data.nextpm && data.nextpm.chk_ok === false) {
                this.stats.checksumFailures++;
                this.log('WARN', 'Checksum failure detected', data);
            }

            // Update sensor info cache
            this.updateSensorCache(data);

            // Emit parsed data
            this.emit('data', {
                raw: line,
                parsed: data,
                timestamp: Date.now()
            });

        } catch (error) {
            // Not JSON, might be startup message
            this.log('DEBUG', 'Non-JSON message', line);
            this.emit('data', {
                raw: line,
                parsed: null,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Update sensor info cache
     */
    updateSensorCache(data) {
        if (data.fw_esp32) {
            this.sensorInfo.fwESP32 = data.fw_esp32;
        }

        if (data.nextpm && data.nextpm.fw) {
            this.sensorInfo.fwSensor = data.nextpm.fw.u16_swap;
            this.sensorInfo.binsSupported = this.sensorInfo.fwSensor >= 1047;
        }

        if (data.nextpm && typeof data.nextpm.state !== 'undefined') {
            this.sensorInfo.state = data.nextpm.state;
        }

        if (data.ts_ms) {
            this.sensorInfo.lastUpdate = data.ts_ms;
        }
    }

    /**
     * Send command to device
     */
    async sendCommand(command) {
        if (!this.isConnected || !this.writer) {
            this.log('ERROR', 'Not connected');
            throw new Error('Not connected');
        }

        try {
            this.log('INFO', 'TX', command);
            this.stats.commandsSent++;

            const data = new TextEncoder().encode(command + '\n');
            await this.writer.write(data);

            return true;

        } catch (error) {
            this.log('ERROR', 'Send command failed', error);
            this.stats.errors++;
            this.emit('error', { type: 'send', error, command });
            throw error;
        }
    }

    /**
     * Send command and wait for response
     */
    async sendAndWait(command, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                cleanup();
                reject(new Error('Timeout waiting for response'));
            }, timeout);

            const dataHandler = (event) => {
                if (event.parsed && event.parsed.info) {
                    cleanup();
                    resolve(event.parsed);
                }
            };

            const cleanup = () => {
                clearTimeout(timeoutId);
                const index = this.listeners.data.indexOf(dataHandler);
                if (index > -1) {
                    this.listeners.data.splice(index, 1);
                }
            };

            this.on('data', dataHandler);
            this.sendCommand(command).catch(reject);
        });
    }

    /**
     * Query basic sensor information
     */
    async querySensorInfo() {
        try {
            this.log('INFO', 'Querying sensor info...');

            // Query firmware versions
            await this.sendCommand('PING');
            await this.delay(200);
            await this.sendCommand('FW');
            await this.delay(200);
            await this.sendCommand('STATE');

        } catch (error) {
            this.log('ERROR', 'Failed to query sensor info', error);
        }
    }

    /**
     * Get current sensor temperature and humidity
     */
    async getTRH() {
        try {
            const response = await this.sendAndWait('TRH', 3000);
            if (response.ok && response.trh) {
                return {
                    temperature: response.trh.t_c_swap,
                    humidity: response.trh.rh_pct_swap,
                    state: response.nextpm.state,
                    checksumOk: response.nextpm.chk_ok
                };
            }
            return null;
        } catch (error) {
            this.log('ERROR', 'getTRH failed', error);
            return null;
        }
    }

    /**
     * Get PM measurements
     */
    async getPM(average = '1m') {
        try {
            const cmd = average === '10s' ? 'PM' : `PM ${average.toUpperCase()}`;
            const response = await this.sendAndWait(cmd, 3000);

            if (response.ok && response.pm) {
                return {
                    pm1: response.pm.ug_m3.pm1_swap,
                    pm25: response.pm.ug_m3.pm25_swap,
                    pm10: response.pm.ug_m3.pm10_swap,
                    nb_l: {
                        pm1: response.pm.nb_l.pm1_swap,
                        pm25: response.pm.nb_l.pm25_swap,
                        pm10: response.pm.nb_l.pm10_swap
                    },
                    average: response.avg,
                    state: response.nextpm.state,
                    checksumOk: response.nextpm.chk_ok
                };
            }
            return null;
        } catch (error) {
            this.log('ERROR', 'getPM failed', error);
            return null;
        }
    }

    /**
     * Get BINS data
     */
    async getBINS(average = '10s') {
        try {
            const cmd = average === '10s' ? 'BINS' : `BINS ${average.toUpperCase()}`;
            const response = await this.sendAndWait(cmd, 10000); // BINS can be slow

            if (response.ok && response.raw) {
                // Parse BINS raw data
                const rawBytes = response.raw.split(' ').map(b => parseInt(b, 16));

                // BINS frame format: [ADDR, CMD, STATE, ...23 bytes total]
                // Bins are 16-bit values at specific offsets
                const bins = this.parseBinsData(rawBytes);

                return {
                    bins,
                    raw: response.raw,
                    average: response.avg,
                    checksumOk: response.chk_ok
                };
            }
            return null;
        } catch (error) {
            this.log('WARN', 'getBINS failed (may not be supported)', error);
            return null;
        }
    }

    /**
     * Parse BINS raw data into bin values
     */
    parseBinsData(bytes) {
        // BINS format (23 bytes total):
        // [0] = 0x81 (address)
        // [1] = 0x25/0x26/0x27 (command)
        // [2] = state
        // [3-4] = bin 0 (0.3-0.5 µm)
        // [5-6] = bin 1 (0.5-1.0 µm)
        // [7-8] = bin 2 (1.0-2.5 µm)
        // [9-10] = bin 3 (2.5-5.0 µm)
        // [11-12] = bin 4 (5.0-10 µm)
        // [13-20] = reserved
        // [21-22] = checksum

        if (bytes.length < 23) {
            return null;
        }

        // Extract bins (swap endianness: MSB first)
        const bins = [];
        for (let i = 0; i < 5; i++) {
            const offset = 3 + (i * 2);
            const value = (bytes[offset] << 8) | bytes[offset + 1];
            bins.push(value);
        }

        return {
            bin0: bins[0], // 0.3-0.5 µm
            bin1: bins[1], // 0.5-1.0 µm
            bin2: bins[2], // 1.0-2.5 µm
            bin3: bins[3], // 2.5-5.0 µm
            bin4: bins[4]  // 5.0-10 µm
        };
    }

    /**
     * Get complete snapshot
     */
    async getSnapshot(average = '10s') {
        try {
            const cmd = average === '10s' ? 'SNAPSHOT' : `SNAPSHOT ${average.toUpperCase()}`;
            const response = await this.sendAndWait(cmd, 15000); // SNAPSHOT is slow

            if (response.ok) {
                return {
                    parts: response.parts,
                    fwRaw: response.fw_raw,
                    stateRaw: response.state_raw,
                    trhRaw: response.trh_raw,
                    pmRaw: response.pm_raw,
                    binsRaw: response.bins_raw,
                    average: response.avg
                };
            }
            return null;
        } catch (error) {
            this.log('ERROR', 'getSnapshot failed', error);
            return null;
        }
    }

    /**
     * Utility: delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get connection status
     */
    getStatus() {
        return {
            connected: this.isConnected,
            sensorInfo: this.sensorInfo,
            stats: this.stats
        };
    }

    /**
     * Calculate Air Quality Index from PM2.5
     * Based on US EPA standards
     */
    static calculateAQI(pm25) {
        if (pm25 <= 12.0) {
            return { level: 'good', label: 'Bon', color: '#00e400', value: Math.round((50 / 12.0) * pm25) };
        } else if (pm25 <= 35.4) {
            return { level: 'moderate', label: 'Modéré', color: '#ffff00', value: Math.round(50 + ((100 - 50) / (35.4 - 12.1)) * (pm25 - 12.1)) };
        } else if (pm25 <= 55.4) {
            return { level: 'unhealthy-sensitive', label: 'Mauvais pour groupes sensibles', color: '#ff7e00', value: Math.round(100 + ((150 - 100) / (55.4 - 35.5)) * (pm25 - 35.5)) };
        } else if (pm25 <= 150.4) {
            return { level: 'unhealthy', label: 'Mauvais', color: '#ff0000', value: Math.round(150 + ((200 - 150) / (150.4 - 55.5)) * (pm25 - 55.5)) };
        } else if (pm25 <= 250.4) {
            return { level: 'very-unhealthy', label: 'Très mauvais', color: '#8f3f97', value: Math.round(200 + ((300 - 200) / (250.4 - 150.5)) * (pm25 - 150.5)) };
        } else {
            return { level: 'hazardous', label: 'Dangereux', color: '#7e0023', value: Math.round(300 + ((500 - 300) / (500.4 - 250.5)) * (pm25 - 250.5)) };
        }
    }
}

// Export for use in app.js
window.NextPMKernel = NextPMKernel;
