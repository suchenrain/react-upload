const http = require('http');
const path = require('path');
const fse = require('fs-extra');
const multiparty = require('multiparty');

const server = http.createServer();
const UPLOAD_DIR = path.resolve(__dirname, '..', 'target');

const resolvePost = (req) => {
	return new Promise((resolve) => {
		let chunk = '';
		req.on('data', (data) => {
			chunk += data;
		});
		req.on('end', () => {
			resolve(JSON.parse(chunk));
		});
	});
};

const extractExt = (filename) =>
	filename.slice(filename.lastIndexOf('.'), filename.length);

const createUploadedList = async (fileHash) => {
	const fileDir = `${UPLOAD_DIR}/${fileHash}`;
	return fse.existsSync(fileDir) ? await fse.readdir(fileDir) : [];
};

const mergeFileChunks = async (targetFilePath, fileHash) => {
	const chunkDir = `${UPLOAD_DIR}/${fileHash}`;
	const chunksPaths = await fse.readdir(chunkDir);
	//根据分片下表排序
	chunksPaths.sort((a, b) => a.split('_')[1] - b.split('_')[1]);
	
	await fse.writeFileSync(targetFilePath, '');
	chunksPaths.forEach((chunkPath) => {
		const chunk = `${chunkDir}/${chunkPath}`;
		fse.appendFileSync(targetFilePath, fse.readFileSync(chunk));
		fse.unlinkSync(chunk);
	});
	fse.rmdirSync(chunkDir);
};

server.on('request', async (req, res) => {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Headers', '*');
	if (req.method === 'OPTIONS') {
		res.status = 200;
		res.end();
		return;
	}

	if (req.url === '/verify') {
		const data = await resolvePost(req);
		const { fileHash, fileName } = data;

		const ext = extractExt(fileName);
		const filePath = `${UPLOAD_DIR}/${fileHash}${ext}`;

		if (fse.existsSync(filePath)) {
			res.end(
				JSON.stringify({
					shouldUploadFile: false,
				})
			);
		} else {
			res.end(
				JSON.stringify({
					shouldUploadFile: true,
					uploadedChunks: await createUploadedList(fileHash),
				})
			);
		}
		return;
	}

	if (req.url === '/merge') {
		const data = await resolvePost(req);
		const { fileHash, fileName } = data;
		const ext = extractExt(fileName);
		const targetFilePath = `${UPLOAD_DIR}/${fileHash}${ext}`;
		await mergeFileChunks(targetFilePath, fileHash);
		res.end(
			JSON.stringify({
				code: 0,
				msg: `file ${fileName} merged.`,
			})
		);
		return;
	}

	const multipart = new multiparty.Form();

	multipart.parse(req, async (err, fields, files) => {
		if (err) {
			return;
		}
		const [chunk] = files.chunk;
		const [hash] = fields.hash;
		const [fileHash] = fields.fileHash;
		const chunkDir = `${UPLOAD_DIR}/${fileHash}`;

		if (!fse.existsSync(chunkDir)) {
			await fse.mkdirs(chunkDir);
		}

		await fse.move(chunk.path, `${chunkDir}/${hash}`, { overwrite: true });
		res.end('received file chunk');
	});
});

server.listen(8080, () => console.log('listening 8080...'));
