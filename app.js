var express = require('express');
var http = require('http');
var net = require('net');
var path = require('path');
var app = express();

var TCPContent = require('./lib/tcpcontent');

///// static file
app.use(express.static(path.join(__dirname, 'public')));

//TODO request timeout

///// app route
app.post('/', function(clientRequest, clientResponse){
	var tcpContent = new TCPContent();

	clientRequest.on('data', function(buffer){
		//リクエスト読み込み
		tcpContent.processReadRequest(buffer, () => {
			//bufferの読み込み完了

			if(!tcpContent.isRequestReadEnd()){
				//HTTPリクエストの読み込みが完了していない場合

				clientResponse.json({
					status: 'error',
					err: {},
					message: 'There is a shortage of telegrams'
				});
				console.log('There is a shortage of telegrams', {});
				return;
			}

			//接続先へリクエスト送信 
			sendRequest(tcpContent, function(){
				//クライアントへレスポンスを返す
				clientResponse.json({
					status: 'success',
					request: tcpContent.generateRequestBuffer().toString(),
					response: tcpContent.generateResponseBuffer().toString()
				});
			}, function(err, message){
				//エラー
				clientResponse.json({
					status: 'error',
					err: err,
					message: message
				});
				console.log(message, err);
			});
		}).catch((err) => {
			//内部エラー
			clientResponse.json({
				status: 'error',
				err: err.toString(),
				message: 'Internal Error at read client request'
			});

			console.log('Internal Error at read client request', err);
		});
	});
	clientRequest.on('error', (err) => {
		//クライアント 通信エラー
		clientResponse.json({
			status: 'error',
			err: err,
			message: 'Client Network Error at client request'
		});
		console.log('Client Network Error at client request', err);
	});
});

///// HTTP Server
var server = http.createServer(app).listen(process.env.PORT || 3000, function(){
	console.log('httptelegram start.');
});

///// function
function sendRequest(tcpContent, onResponseEnd, onError){
	var hostname = tcpContent.getRequestHostname();
	var port = tcpContent.getRequestPort();

	var serverSocket = net.connect(port, hostname);
	serverSocket.on('data', (buffer) => {
		//読み込み
		tcpContent.processReadResponse(buffer, () => {
			//bufferの読み込み完了
			if(tcpContent.isResponseReadEnd()){
				//クライアントへレスポンスを返す
				if(onResponseEnd){
					onResponseEnd();
				}
				serverSocket.end();
			}
		}).catch((err) => {
			//内部エラー
			if(onError){
				onError(err.toString(), 'Internal Error at read server response');
			}
			serverSocket.end();
		});
	});
	serverSocket.on('error', (err) => {
		//サーバー 通信エラー
		if(onError){
			onError(err, 'Server Network Error at server request');
		}
		serverSocket.end();
	});

	//書き込み
	serverSocket.write(tcpContent.generateRequestBuffer());
}