import { getHID } from './hid-loader';

class MatDevice {
private device: InstanceType<ReturnType<typeof getHID>['HID']> | null = null;
    private isConnected: boolean = false;
    private scanInterval: NodeJS.Timeout | null = null;
    private callback: (data: number[]) => void = () => { };

    private datagrid: number[][] = new Array(64).fill(0).map(() => new Array(64).fill(0));

    constructor(private readonly vid: number, private readonly pid: number, private readonly PollRateMs: number) { }

    get connected(): boolean {
        return this.isConnected;
    }

    public onDeviceData(callback: (data: number[]) => void): void {
        this.callback = callback;
    }

    public start(): void {
        console.log("Starting Mat Service")
        setInterval(this.scan.bind(this), 5000);
        setInterval(this.transmitDeviceData.bind(this), this.PollRateMs);
        this.scan();
    }

    public stop(): void {
        if (this.device) {
            this.device.close();
            this.device = null;
        }

        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }
    }

 private scan(): void {
    if (!this.device) {
        const HID = getHID();  // ← add this line
        const devices = HID.devices();
        const device = devices.find((device) => device.vendorId === this.vid && device.productId === this.pid);
        if (device) {
            this.device = new HID.HID(device.vendorId, device.productId);
            this.device.on('data', this.onData.bind(this));
            this.device.on('error', this.onError.bind(this));
            this.isConnected = true;
            console.log("Device Connected !")
        }
    }
}

    private onData(data: Buffer): void {
        for (let index = 1; index < data.length - 1; index += 3) {
            const num1 = data[index];
            const num2 = data[index + 1];
            const num3 = data[index + 2];
            if (data[0] === 0 || num1 === 0 || num2 === 0) break;

            if (data[0] < 5) {
                const x = 16 * Math.floor((9 - data[0]) / 5) + (16 - num1)
                const y = 16 * (data[0] - 1) + (16 - num2)
                // console.log(x, ",", y)
                this.datagrid[x][y] = num3;
            } else if (data[0] < 9) {
                const x = 16 * Math.floor((9 - data[0]) / 5) + (num1 - 1)
                const y = 16 * (8 - data[0]) + (num2 - 1)
                // console.log(x, ",", y)
                this.datagrid[x][y] = num3;
            }
        }
    }

    private onError(error: Error): void {
        console.error('Error:', error);
        this.isConnected = false;
        this.device = null;
        console.log("Device Disconnected !")
    }

    private transmitDeviceData() {
        const res: number[] = [];

        for (const r of this.datagrid) {
            res.push(...r);
        }

        this.callback(res);
    }
}










export function startMatService(): MatDevice {
    const mat = new MatDevice(6860, 6733, 1000);
    // mat.onDeviceData((data) => {
    //     console.log('Data:', data);
    // });
    mat.start();
    return mat;

}
