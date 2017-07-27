const HTTPBlankLine = Buffer.from([13, 10, 13, 10]);// \r\n\r\n
const ChunkedLastBody = Buffer.from([48, 13, 10, 13, 10]);//0 改行 改行
const DefaultPort = 80;

function HTTPContent(onReadEnd){
	this.buffer = Buffer.from([]);

	this.line;
	this.headers = [];
	this.body = Buffer.from([]);

	this.hostname;
	this.port;

	this.isBodyReading = false;
	this.isReadEnd = false;

	this.onReadEnd = onReadEnd;
}

HTTPContent.prototype.read = function(buffer){
	if(this.isBodyReading){
		//body読み込み途中の場合
		return this.readBody(buffer);
	}

	//読み込み開始
	return this.readBuffer(buffer);
};
HTTPContent.prototype.generateBuffer = function(){
	//ライン
	var meta = this.line.toString() + '\r\n';
	//ヘッダー
	meta += this.generateHeaderString();
	//空白行
	meta += '\r\n';

	var result = Buffer.from(meta);

	if(this.body && this.body.length > 0){
		//ボディ
		result = Buffer.concat([result, this.body]);
	}

	return result;
};
HTTPContent.prototype.readBuffer = function(buffer){
	//バッファリング
	this.buffer = Buffer.concat([this.buffer, buffer]);

	const blankLineIndex = this.buffer.indexOf(HTTPBlankLine);
	if(blankLineIndex >= 0){
		//空白行が含まれる場合
		const meta = this.buffer.slice(0, blankLineIndex).toString();
		const buff = this.buffer.slice((blankLineIndex + HTTPBlankLine.length), this.buffer.length);

		const lines = meta.split('\r\n');
		this.readLine(lines[0]);
		this.readHeaders(lines.slice(1));

		if(this.hasBody()){
				return this.readBody(buff);
		}else{
			//ボディがない場合

			//read end
			this.readEnd();

			if(buff && buff.length > 0){
				//次のContentを読み込んだ場合
				return buff;
			}
		}
	}
};
HTTPContent.prototype.readLine = function(line){
	this.line = line;
};
HTTPContent.prototype.readHeaders = function(lines){
	var len = lines.length;
	for(var i=0; i<len; i++){
		var val = lines[i];
		var index = val.indexOf(':');

		var name = val.substring(0, index).trim()
		var value = val.substring(index + 1, val.length).trim()

		//hostヘッダ
		if(name.toLowerCase() === 'host'){
			var separatorIndex = value.indexOf(':');
			if(separatorIndex >= 0){
				this.hostname = value.substring(0, separatorIndex);
				this.port = parseInt(value.substring(separatorIndex + 1, value.length));
			}else{
				this.hostname = value;
				this.port = DefaultPort;
			}
		}

		this.headers.push({
			name: name,
			value: value
		});
	}
};
HTTPContent.prototype.writeHeader = function(name, value){
	var len = this.headers.length;
	for(var i=0; i<len; i++){
		var header = this.headers[i];
		if(name.toLowerCase() === header.name.toLowerCase()){
			this.headers[i] = {
				name: name,
				value: value
			};
		}
	}
};
HTTPContent.prototype.getHeaderValue = function(name){
	var len = this.headers.length;
	for(var i=0; i<len; i++){
		var header = this.headers[i];
		if(name.toLowerCase() === header.name.toLowerCase()){
			return header.value;
		}
	}
};
HTTPContent.prototype.hasHeader = function(name){
	var len = this.headers.length;
	for(var i=0; i<len; i++){
		var header = this.headers[i];
		if(name.toLowerCase() === header.name.toLowerCase()){
			return true;
		}
	}
};
HTTPContent.prototype.generateHeaderString = function(){
	var headerString = '';
	//ヘッダ
	var len = this.headers.length;
	for(var i=0; i<len; i++){
		var headerData = this.headers[i];
		headerString += headerData.name + ': ' + headerData.value + '\r\n';
	}
	return headerString;
};
HTTPContent.prototype.hasBody = function(){
	var contentLength = this.getContentLength();
	if(contentLength && contentLength > 0){
		return true;
	}

	if(this.isChunked()){
		return true;
	}

	return false;
};
HTTPContent.prototype.isChunked = function(){
	var transferEncodingStr = this.getHeaderValue('transfer-encoding');
	return transferEncodingStr && transferEncodingStr === 'chunked';
};
HTTPContent.prototype.readBody = function(buffer){
	var bodyBuffer = Buffer.concat([this.body, buffer]);

	if(this.hasHeader('content-length')){
		//content-length
		var contentLength = this.getContentLength();
		if(contentLength < bodyBuffer.length){
			//次のContentが含まれる場合
			this.body = bodyBuffer.slice(0, contentLength);
			//read end
			this.readEnd();
			
			//次の読み込み処理へ
			return bodyBuffer.slice(contentLength, bodyBuffer.length);
		}else if(contentLength === bodyBuffer.length){
			//読み込み完了
			this.body = bodyBuffer;
			//read end
			this.readEnd();
		}else{
			//body読み込み途中
			this.isBodyReading = true;
			this.body = bodyBuffer;
		}
	}

	if(this.isChunked()){
		//chuked
		var chunkedBodyLastIndex = bodyBuffer.indexOf(ChunkedLastBody);
		if(chunkedBodyLastIndex < 0){
			//body読み込み途中
			this.isBodyReading = true;
			this.body = bodyBuffer;
		}else{
			var sliceIndex = chunkedBodyLastIndex + ChunkedLastBody.length;
			if(bodyBuffer.length === sliceIndex){
				//読み込み完了
				this.body = bodyBuffer;
				//read end
				this.readEnd();
			}else{
				//次のContentが含まれる場合
				this.body = bodyBuffer.slice(0, sliceIndex);
				//read end
				this.readEnd();
				//次の読み込み処理へ
				return bodyBuffer.slice(sliceIndex, bodyBuffer.length);
			}
		}
	}
};
HTTPContent.prototype.getContentLength = function(){
	var contentLengthStr = this.getHeaderValue('content-length');
	if(contentLengthStr){
		var contentLength = parseInt(contentLengthStr);
		if(contentLength > 0){
			return contentLength;
		}
	}
};
HTTPContent.prototype.readEnd = function(){
	this.isReadEnd = true;
	this.buffer = Buffer.from([]);
	if(this.onReadEnd){
		this.onReadEnd(this);
	}
};


module.exports = HTTPContent;