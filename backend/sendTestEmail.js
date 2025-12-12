import nodemailer from 'nodemailer';

let notifier = "notification.alert@equicomservices.com";
let managerDummypatotie = "appdev@equicomservices.com";
let employeeDummy = "hero.baceles.cln@gmail.com";

// Create a transporter
let transporter = nodemailer.createTransport({
  host: 'smtp-relay.gmail.com',
  port: 587, 
  secure: false, 
  auth: false  
});

let info = await transporter.sendMail({
  from: notifier,
  to: managerDummypatotie, 
  cc: [employeeDummy, 'hero.baceles.coi@pcu.edu.ph'], // Corrected syntax for CC
  bcc: ['bcc@example.com', 'bcc2@example.com'], 
  subject: 'Test Email ✔',
  text: 'Testing Futura.',
  html: '<b>Testing Futura</b>'
});

console.log('Email sent: ' + info.messageId);
