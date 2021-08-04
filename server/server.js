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

const extractFileName = (filename) =>
	filename.slice(0, filename.lastIndexOf('.'));

const mergeFileChunks = async (filePath, fileName) => {
	const chunkDir = `${UPLOAD_DIR}/${extractFileName(fileName)}`;
	const chunksPaths = await fse.readdir(chunkDir);
	await fse.writeFileSync(filePath, '');
	chunksPaths.forEach((chunkPath) => {
		const chunk = `${chunkDir}/${chunkPath}`;
		fse.appendFileSync(filePath, fse.readFileSync(chunk));
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

	if (req.url === '/merge') {
		const data = await resolvePost(req);
		const { fileName } = data;
		const filePath = `${UPLOAD_DIR}/${fileName}`;
		await mergeFileChunks(filePath, fileName);
		res.end(
			JSON.stringify({
				code: 0,
				msg: `file  ${fileName} merged.`,
			})
		);
	}

	const multipart = new multiparty.Form();

	multipart.parse(req, async (err, fields, files) => {
		if (err) {
			return;
		}
		const [chunk] = files.chunk;
		const [hash] = fields.hash;
		const [filename] = fields.filename;
		const chunkDir = `${UPLOAD_DIR}/${extractFileName(filename)}`;

		if (!fse.existsSync(chunkDir)) {
			await fse.mkdirs(chunkDir);
		}

		await fse.move(chunk.path, `${chunkDir}/${hash}`, { overwrite: true });
		res.end('received file chunk');
	});
});

server.listen(8080, () => console.log('listening 8080...'));
