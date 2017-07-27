const HTTPContent = require('./httpcontent.js');

function TCPContent(){
	this.requests = [];
	this.responses = [];

	this.readRequestPromise = Promise.resolve();
	this.readResponsePromise = Promise.resolve();
}
TCPContent.prototype.getRequestHostname = function(){
	return this.requests[0].hostname;
};
TCPContent.prototype.getRequestPort = function(){
	return this.requests[0].port;
};
TCPContent.prototype.processReadRequest = function(buffer, onBufferReadEnd, onHTTPRequest){
	return this.readRequestPromise = this.readRequestPromise.then(() => {
		return new Promise((resolve, reject) => {
			this.readBuffer(buffer, this.requests, onHTTPRequest);
			onBufferReadEnd();
			resolve();
		});
	});

};
TCPContent.prototype.processReadResponse = function(buffer, onBufferReadEnd, onHTTPResponse){
	return this.readResponsePromise = this.readResponsePromise.then(() => {
		return new Promise((resolve, reject) => {
			this.readBuffer(buffer, this.responses, onHTTPResponse);
			onBufferReadEnd();
			resolve();
		});
	});
};
TCPContent.prototype.generateRequestBuffer = function(){
	//書き込み可能なHTTPリクエストを生成する
	return generateHTTPBuffer(this.requests);
};
TCPContent.prototype.generateResponseBuffer = function(){
	//書き込み可能なHTTPレスポンスを生成する
	return generateHTTPBuffer(this.responses);
};
TCPContent.prototype.isRequestReadEnd = function(){
	return this.isReadEnd(this.requests);
};
TCPContent.prototype.isResponseReadEnd = function(){
	return this.isReadEnd(this.responses);
};
TCPContent.prototype.isReadEnd = function(httpContentList){
	var len = httpContentList.length;
	for(var i=0; i<len; i++){
		var content = httpContentList[i];
		if(!content.isReadEnd){
			return false;
		}
	}
	return true;
};
TCPContent.prototype.readBuffer = function(buffer, contentList, onReadEnd){
	if(contentList.length === 0 || contentList[contentList.length - 1].isReadEnd){
		//bufferの先頭に改行がある場合、除外する
		buffer = removeLeadingBlankLine(buffer);
		//HTTPContentの生成
		contentList.push(new HTTPContent(onReadEnd));
	}

	var currentContent = contentList[contentList.length - 1];
	
	//読み込み
	var remainBuffer = currentContent.read(buffer);
	if(remainBuffer){
		//次を読み込んだ場合、再度読み込み開始
		this.readBuffer(remainBuffer, contentList, onReadEnd);
	}
};

///// private function
function generateHTTPBuffer(contentList){
	const result = [];

	var len = contentList.length;
	for(var i=0; i<len; i++){
		var httpContent = contentList[i];
		if(httpContent.isReadEnd){
			//読み込みが完了したContent
			result.push(httpContent.generateBuffer());
		}
	}

	return Buffer.concat(result);
}

function removeLeadingBlankLine(buffer){
	var blankLineBuffer = Buffer.from('\r\n');
	while(buffer.indexOf(blankLineBuffer) === 0){
		buffer = buffer.slice(2, buffer.length);
	}
	return buffer;
}


module.exports = TCPContent;