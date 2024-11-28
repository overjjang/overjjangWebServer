var express = require('express');
const dotenv = require('dotenv');
const fs = require('fs');
const bodyParser = require('body-parser');
const cron = require('node-cron');

var router = express.Router();

const statusRouter = require('../models/chart.model');
const recordServerStatus = require('../recordState');

const serverName = process.env.SERVER_IP;

let cronTime = {
    time: 0,
    isOn:false
}

router.get('/',(req ,res)=>{
    res.render('../views/api-index');
});
router.get('/work',(req ,res)=>{
    res.render('../views/work',{cronTime});
});
router.get('/chart',(req ,res)=>{
    res.render('../views/chart');
});
//작업내용 확인
router.get('/status', (req, res) => {

    res.render('../views/status');
});

router.get('/getWorkStatus', async (req, res) => {
    const serverNames = JSON.parse(fs.readFileSync('./servers.json', 'utf-8'));
    const latestRecord = [];
    const date = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
    for (let i in serverNames) {
        const data = await statusRouter.findOne({ serverName: serverNames[i], date: date });
        if(data.history) {
            latestRecord.push(data.history[data.history.length - 1]);
        }else {
            latestRecord.push({ time: 'unrecorded', userCount: 0, isServerOn: false });
        }
    }
    const cronTasks = cronTime;
    res.json({cronTasks, serverNames, latestRecord });
});

//------------------------post------------------------
router.post('/updateServerState', (req, res) => {
    recordServerStatus[1]()
        .then(() => res.sendStatus(200))
        .catch(err => res.status(500).send(err));
});


router.post('/createRecord', (req, res) => {
    recordServerStatus[2]()
        .then(() => res.sendStatus(200))
        .catch(err => res.status(500).send(err));
});


router.post('/saveRecord', (req, res) => {
    recordServerStatus[0]()
        .then(() => res.sendStatus(200))
        .catch(err => res.status(500).send(err));
});


router.post('/scheduleCronJob', async (req, res) => {
    const time = req.body.repeatTime;
    cronTime.time = time;
    cronTime.isOn = true;
    cron.schedule(`*/${time} * * * *`, () => {
        recordServerStatus[1]();
    });
    cron.schedule('0 0 * * *', () => {
        recordServerStatus[2]();
    });
    res.sendStatus(200);
    console.log(`Cron job scheduled to run every ${time} minutes`);
});


router.post('/stopScheduledCronJob', (req, res) => {
    cron.cancelAll();
    cronTime.isOn = false;
    res.sendStatus(200);
});


router.post('/addServer', async (req, res) => {
    const serverName = req.body.serverName;
    const serverNames = await JSON.parse(fs.readFileSync('./servers.json', 'utf-8'));
    if (!serverNames.includes(serverName)) {
        serverNames.push(serverName);
        fs.writeFileSync('./servers.json', JSON.stringify(serverNames));
        res.sendStatus(200);
    } else {
        res.status(409).send('Server already exists');
    }
});


router.get('/getServers', async (req, res) => {
    try {
        const date = req.query.date ? req.query.date : new Date().toISOString().split('T')[0]; // Read date from query parameters
        // const serverNames = await JSON.parse(fs.readFileSync('./servers.json', 'utf-8'));
        const serverNames = await statusRouter.find({ date: date }).distinct('serverName');
        res.json(serverNames);
    } catch (error) {
        res.status(500).send(error);
    }
});


router.get('/getChartData', async (req, res) => {
    try {
        const date = new Date(req.query.date); // Read date from query parameters
        const serverName = req.query.serverName; // Read serverName from query parameters
        if (!date || !serverName) {
            return res.status(400).send('Date and Name parameter is required');
        }
        const data = await statusRouter.findOne({ date: date,serverName : serverName }); // Ensure this returns an array
        res.json(data.history); // Ensure this returns an array
    } catch (error) {
        res.status(500).send(error);
    }
});


module.exports = router;