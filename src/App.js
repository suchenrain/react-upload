import './App.css';
import { Upload, Button, Row, Col, Progress } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useRef, useState } from 'react';
import { request } from './request';

function App() {
	const [file, setFile] = useState(null);
	const [hashPercent, setHashPercent] = useState(0);
	const uploadRef = useRef({ chunks: [], fileHash: null });
	const CHUNK_COUNT = 10;

	const beforeUpload = (file) => {
		setHashPercent(0);
		setFile(file);
		return false;
	};

	const upload = async () => {
		if (!file) return;
		const fileChunkList = createChunks(file);
		uploadRef.current.fileHash = await computeHash(fileChunkList);

		const chunkArr = fileChunkList.map(({ fileChunk }, index) => ({
			fileHash: uploadRef.current.fileHash,
			chunk: fileChunk,
			hash: `${uploadRef.current.fileHash}-${index}`,
		}));
		uploadRef.current.chunks = chunkArr;

		await uploadChunks();
	};

	const uploadChunks = async () => {
		const chunks = uploadRef.current.chunks;
		if (chunks.length < 1) return;

		let reqList = chunks
			.map(({ chunk, hash, fileHash }) => {
				let formData = new FormData();
				formData.append('chunk', chunk);
				formData.append('hash', hash);
				formData.append('fileHash', fileHash);
				formData.append('filename', file.name);
				return { formData };
			})
			.map(({ formData }) => {
				return request({
					url: 'http://localhost:8080',
					data: formData,
				});
			});

		// 发送切片
		let res = await Promise.all(reqList);

		// 发送合并请求
		await mergeRequest();
	};

	const mergeRequest = async () => {
		await request({
			url: 'http://localhost:8080/merge',
			headers: {
				'content-type': 'application/json',
			},
			data: JSON.stringify({
				fileHash: uploadRef.current.fileHash,
				fileName: file.name,
			}),
		});
	};

	const createChunks = (file, counts = CHUNK_COUNT) => {
		const fileChunkList = [];
		const chunkSize = Math.ceil(file.size / counts);
		let cur = 0;
		while (cur < file.size) {
			fileChunkList.push({ fileChunk: file.slice(cur, cur + chunkSize) });
			cur += chunkSize;
		}
		return fileChunkList;
	};

	const computeHash = (fileChunks) => {
		return new Promise((resolve, reject) => {
			const hashWorker = new Worker('/workers/hash.js');
			hashWorker.postMessage({ fileChunks });
			hashWorker.onmessage = (e) => {
				const { percentage, hash } = e.data;
				setHashPercent(percentage);
				if (hash) {
					resolve(hash);
				}
			};
		});
	};

	return (
		<div className='container'>
			<Row gutter={[16, 16]} justify='space-between'>
				<Col>
					<Upload beforeUpload={beforeUpload} maxCount={1}>
						<Button icon={<UploadOutlined />}>选择文件</Button>
					</Upload>
				</Col>
				<Col>
					<Button type='primary' onClick={upload} disabled={!file}>
						上传
					</Button>
				</Col>
			</Row>
			<Row>
				<Col span={24}>计算文件hash进度：</Col>
				<Col span={24}>
					<Progress percent={hashPercent} />
				</Col>
			</Row>
		</div>
	);
}

export default App;
