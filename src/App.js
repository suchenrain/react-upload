import './App.css';
import { Upload, Button, Row, Col, Progress, Divider } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useMemo, useRef, useState } from 'react';
import { request } from './request';

function App() {
	const [file, setFile] = useState(null);
	const [hashPercent, setHashPercent] = useState(0);
	const [chunks, setChunks] = useState([]);
	const fileHashRef = useRef(null);
	const CHUNK_COUNT = 10;

	const totalPercent = useMemo(() => {
		if (!file || chunks.length < 1) return 0;
		const loaded = chunks
			.map((item) => {
				return item.chunk.size * item.percent;
			})
			.reduce((acc, cur) => acc + cur);

		return (loaded / file.size).toFixed(2);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [chunks]);

	const beforeUpload = (file) => {
		// clear
		setHashPercent(0);
		setChunks([]);
		fileHashRef.current = null;

		setFile(file);
		return false;
	};

	const upload = async () => {
		if (!file) return;
		const fileChunkList = createChunks(file);
		fileHashRef.current = await computeHash(fileChunkList);

		const chunkArr = fileChunkList.map(({ fileChunk }, index) => ({
			fileHash: fileHashRef.current,
			chunk: fileChunk,
			hash: `${fileHashRef.current}-${index}`,
			percent: 0,
		}));

		//render chunks
		setChunks(chunkArr);

		await uploadChunks(chunkArr);
	};

	const uploadChunks = async (chunks) => {
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
			.map(({ formData }, index) => {
				return request({
					url: 'http://localhost:8080',
					data: formData,
					onProgress: createProgressHandler(index),
				});
			});

		// 发送切片
		let res = await Promise.all(reqList);

		// 发送合并请求
		await mergeRequest();
	};

	const createProgressHandler = (index) => {
		return (e) => {
			setChunks((preChunks) => {
				preChunks[index].percent = parseInt(
					String((e.loaded / e.total) * 100)
				);
				return [...preChunks];
			});
		};
	};

	const mergeRequest = async () => {
		await request({
			url: 'http://localhost:8080/merge',
			headers: {
				'content-type': 'application/json',
			},
			data: JSON.stringify({
				fileHash: fileHashRef.current,
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
	const formatBytes = (bytes, decimals = 2) => {
		if (bytes === 0) return '0 Bytes';

		const k = 1024;
		const dm = decimals < 0 ? 0 : decimals;
		const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

		const i = Math.floor(Math.log(bytes) / Math.log(k));

		return (
			parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
		);
	};

	const renderChunks = () => {
		return chunks.map((chunk) => (
			<Row key={chunk.hash}>
				<Col span={10} className='center'>
					{chunk.hash}
				</Col>
				<Col span={4} className='center'>
					{formatBytes(chunk.chunk.size)}
				</Col>
				<Col span={10} className='center'>
					<Progress
						percent={chunk.percent}
						strokeColor={{
							'0%': '#ffc107',
							'100%': '#87d068',
						}}
						style={{ width: '75%' }}
					/>
				</Col>
			</Row>
		));
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
			<Divider />
			{!!file && (
				<>
					<Row>
						<Col span={24}>计算文件hash进度：</Col>
						<Col span={24}>
							<Progress percent={hashPercent} />
						</Col>
					</Row>
					<Divider />
				</>
			)}

			{chunks.length > 0 && (
				<>
					<Row>
						<Col span={4}>上传总进度：</Col>
						<Col span={20}>
							<Progress
								percent={totalPercent}
								steps={CHUNK_COUNT}
								strokeColor='#52c41a'
							/>
						</Col>
					</Row>
					<Divider />
					<Row>
						<Col span={10} className='center'>
							切片Hash
						</Col>
						<Col span={4} className='center'>
							大小
						</Col>
						<Col span={10} className='center'>
							上传进度
						</Col>
					</Row>
				</>
			)}

			{renderChunks()}
		</div>
	);
}

export default App;
