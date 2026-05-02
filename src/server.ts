import express, { Request, Response } from 'express';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { exec } from 'child_process';
import { getUserDataPath } from './paths';
import { startMatService } from './MatService';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: '*' } });
const device = startMatService();

app.use(express.json());
app.use(cors());

const userDataDir = getUserDataPath();
const usersFilePath = path.join(userDataDir, 'usersData.json');
const mattressFilePath = path.join(userDataDir, 'mattressData.json');
const videoFilePath = path.join(userDataDir, 'videoData.json');
const optionsFilePath = path.join(userDataDir, 'optionsData.json');

// Ensure the file exists, if not create it with empty array
const ensureFileExists = (filePath: string) => {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf-8');
    }
};

// Function to read data from a file
const readDataFromFile = (filePath: string) => {
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        return null;
    }
};

// Function to write data to a file
const writeDataToFile = (filePath: string, data: any) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`Data written to ${filePath}`);
    } catch (error) {
        console.error(`Error writing file ${filePath}:`, error);
    }
};

// Check and create files if they don't exist
ensureFileExists(usersFilePath);
ensureFileExists(mattressFilePath);
ensureFileExists(videoFilePath);
ensureFileExists(optionsFilePath);

// Load data from files at startup
let usersData: any = readDataFromFile(usersFilePath);
let mattressData: any = readDataFromFile(mattressFilePath);
let videoData: any = readDataFromFile(videoFilePath);
let optionsData: any = readDataFromFile(optionsFilePath);

// Function to fetch data
const fetchData = async () => {
    try {
        const usersResponse = await axios.get('https://www.restlab.eds-dev.ma/api/getUsers');
        usersData = usersResponse.data;
        writeDataToFile(usersFilePath, usersData);
    } catch (error) {
        console.error('Error fetching users:', error);
    }

    try {
        const mattressResponse = await axios.get('https://www.restlab.eds-dev.ma/api/getMatress');
        mattressData = mattressResponse.data;
        writeDataToFile(mattressFilePath, mattressData);
    } catch (error) {
        console.error('Error fetching mattress:', error);
    }

    try {
        const videoResponse = await axios.get('https://www.restlab.eds-dev.ma/api/setVideo');
        videoData = videoResponse.data;
        writeDataToFile(videoFilePath, videoData);
    } catch (error) {
        console.error('Error fetching video:', error);
    }

    try {
        const optionsResponse = await axios.get('https://www.restlab.eds-dev.ma/api/getOptions');
        optionsData = optionsResponse.data;
        writeDataToFile(optionsFilePath, optionsData);
    } catch (error) {
        console.error('Error fetching options:', error);
    }
};




// Routes to serve the stored data
app.get('/users', (req: Request, res: Response) => {
    if (usersData) {
        res.json(usersData);
    } else {
        res.status(503).send('Users data not available');
    }
});

app.get('/mattress', (req: Request, res: Response) => {
    if (mattressData) {
        res.json(mattressData);
    } else {
        res.status(503).send('Mattress data not available');
    }
});

app.get('/video', (req: Request, res: Response) => {
    if (videoData) {
        res.json(videoData);
    } else {
        res.status(503).send('Video data not available');
    }
});

app.get('/options', (req: Request, res: Response) => {
    if (optionsData) {
        res.json(optionsData);
    } else {
        res.status(503).send('Options data not available');
    }
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('remote', (data) => {
        // console.log('Thermal data:', data);
        io.emit('thermalData', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

device.onDeviceData((data) => {
    //console.log("Data:", data);
    io.emit("thermalData", data);
});


app.get('/wifiList', (req, res) => {
    const command =`sudo iwlist wlan0 scan | grep -E 'ESSID' | awk -F: '{print $2}' | sed 's/"//g' | sed '/^$/d' | sort -u`;

    exec(command, (error, stdout) => {
        if (error) {
            return res.json({ ssids: ['---'] });
        }

        const ssids = stdout.split('\n').filter(ssid => ssid);
        res.json({ ssids });
    });
});

app.post('/connect-wifi', (req, res) => {

    const { ssid, password, isDHCP, ipDetails } = req.body;

    // Construct the nmcli command
    let command = `sudo nmcli dev wifi connect "${ssid}" password "${password}"`;

    if (!isDHCP && ipDetails) {
        command = "sudo nmcli con add type wifi ifname wlan0 con-name Wifi_connection"
        command +=  ssid `${ssid}`;
        command +=  `wifi-sec.key-mgmt wpa-psk wifi-sec.psk "${password}"`;
        command += ' ipv4.method manual';
        const { ip, prefix, gateway, dns } = ipDetails;

        command +=  ` ipv4.addresses "${ip}/${prefix}"`;
        command +=   ` ipv4.gateway "${gateway}"`;

        if (dns && dns.length > 0) {
            const dnsString = dns.filter(Boolean).join(',');
            command += ` ipv4.dns "${dnsString}"`;
        }
        command += " && sudo nmcli con up Wifi_connection"

    }
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error('Error executing command:', stderr);
           if (stderr.includes('802-11-wireless-security.psk') || stderr.includes('Secrets were required')) {
                    return res.status(400).json({ error: 'Invalid password' });
                }
           else  if (stderr.includes('SSID')) return res.status(400).json({ error: 'Invalid SSID' });
           else  if (stderr.includes('invalid prefix')) return res.status(400).json({ error: 'Invalid IP Address' });
           else  if (stderr.includes('invalid IP address')) return res.status(400).json({ error: 'Invalid IP Address' });
           else return res.status(400).json({ message: 'Error connecting to Wi-Fi', error: stderr
});
        }
        res.json({ message: 'Connected successfully', output: stdout });
    });
});

app.get('/status', (req, res) => {
    const commands = {
        ssid: "nmcli -t -f active,ssid dev wifi | grep '^yes:' | cut -d':' -f2",
        ip: "hostname -I | awk '{print $1}'",
        gateway: "ip route | grep default | awk '{print $3}'",
        dns: "grep nameserver /etc/resolv.conf | awk '{print $2}' | head -n 2 | tr '\n' ',' | sed 's/,$//'",
        mask: "ifconfig wlan0 | grep 'netmask' | awk '{print $4}' | cut -d ':' -f2"
    };

    const executeCommand = (cmd: string) => {
        return new Promise((resolve) => {
            exec(cmd, (error, stdout) => {
                if (error) {
                    resolve('---');
                } else {
                    resolve(stdout.trim() || '---');
                }
            });
        });
    };

    const promises = Object.entries(commands).map(([key, command]) => executeCommand(command));

    Promise.all(promises).then(results => {
        const responseData = {
            ssid: results[0],
            ip: results[1],
            gateway: results[2],
            dns: results[3],
            mask: results[4]
        };
        res.json(responseData);
    });
});


export { server , fetchData }
