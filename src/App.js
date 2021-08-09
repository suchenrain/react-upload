import './App.css';
import { Upload, Button, Row, Col, Progress, Divider } from 'antd';
import {
	UploadOutlined,
	CheckCircleFilled,
	CloseCircleFilled,
} from '@ant-design/icons';
import { useMemo, useRef, useState } from 'react';
import { request } from './request';
import toast, { Toaster } from 'react-hot-toast';

const UPLOAD_STATES = {
	INITIAL: 0,
	HASHING: 1,
	UPLOADING: 2,
	PAUSED: 3,
	SUCCESS: 4,
	FAILED: 5,
};

function App() {
	const [file, setFile] = useState(null);
	const [hashPercent, setHashPercent] = useState(0);
	const [chunks, setChunks] = useState([]);
	const [uploadState, setUploadState] = useState(UPLOAD_STATES.INITIAL);
	const fileHashRef = useRef(null);
	const pendingRequest = useRef([]);
	const toastId = useRef(null);
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
		reset();

		setFile(file);
		return false;
	};

	const reset = () => {
		setUploadState(UPLOAD_STATES.INITIAL);
		setHashPercent(0);
		setChunks([]);
		fileHashRef.current = null;
	};

	const shouldUpload = async (fileHash, fileName) => {
		const { data } = await request({
			url: 'http://localhost:8080/verify',
			headers: {
				'content-type': 'application/json',
			},
			data: JSON.stringify({
				fileHash,
				fileName,
			}),
		});
		return JSON.parse(data);
	};

	const upload = async () => {
		try {
			if (uploadState === UPLOAD_STATES.FAILED) {
				await handleResumeUpload();
				return;
			}
			if (uploadState === UPLOAD_STATES.INITIAL) {
				if (!file) return;

				toastId.current = toast.loading('分片...');
				const fileChunkList = createChunks(file);
				setUploadState(UPLOAD_STATES.HASHING);
				toast.loading('hash文件...', { id: toastId.current });
				fileHashRef.current = await computeHash(fileChunkList);
				setUploadState(UPLOAD_STATES.UPLOADING);
				toast.loading('分片上传中...', { id: toastId.current });

				const { shouldUploadFile, uploadedChunks } = await shouldUpload(
					fileHashRef.current,
					file.name
				);
				if (!shouldUploadFile) {
					setUploadState(UPLOAD_STATES.SUCCESS);
					toast.success('文件秒传成功！', { id: toastId.current });
					return;
				}

				const chunkArr = fileChunkList.map(({ fileChunk }, index) => ({
					fileHash: fileHashRef.current,
					chunk: fileChunk,
					hash: `${fileHashRef.current}_${index}`,
					percent: uploadedChunks.includes(
						`${fileHashRef.current}_${index}`
					)
						? 100
						: 0,
				}));

				//render chunks
				setChunks(chunkArr);
				await uploadChunks(chunkArr, uploadedChunks);
			}
		} catch (err) {
			toast.error(`${err}`, { id: toastId.current });
			setUploadState(UPLOAD_STATES.FAILED);
		}
	};

	const uploadChunks = async (chunks, uploadedChunks = []) => {
		if (chunks.length < 1) return;

		let reqList = chunks
			.filter(({ hash }) => !uploadedChunks.includes(hash))
			.map(({ chunk, hash, fileHash }) => {
				let formData = new FormData();
				formData.append('chunk', chunk);
				formData.append('hash', hash);
				formData.append('fileHash', fileHash);
				formData.append('filename', file.name);
				return { formData, hash };
			})
			.map(({ formData, hash }) => {
				return request({
					url: 'http://localhost:8080',
					data: formData,
					onProgress: createProgressHandler(hash),
					requestList: pendingRequest.current,
				});
			});

		// 发送切片
		await Promise.all(reqList);
		if (reqList.length + uploadedChunks.length === chunks.length) {
			// 发送合并请求
			toast.loading('合并文件分片...', { id: toastId.current });
			await mergeRequest();
			setUploadState(UPLOAD_STATES.SUCCESS);
			toast.success('文件已上传', { id: toastId.current });
		} else {
			toast.error('上传失败', { id: toastId.current });
			setUploadState(UPLOAD_STATES.FAILED);
		}
	};
	const createProgressHandler = (hash) => {
		// get initial percent
		const chunk = chunks.find((item) => item.hash === hash);
		const initialPercent = chunk?.percent || 0;

		return (e) => {
			setChunks((preChunks) => {
				let preChunk = preChunks.find((item) => item.hash === hash);
				preChunk.percent =
					initialPercent +
					(e.loaded / e.total) * (100 - initialPercent);
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

	const handlePauseUpload = () => {
		setUploadState(UPLOAD_STATES.PAUSED);
		toast('暂停上传', { id: toastId.current });
		pendingRequest.current.forEach((xhr) => xhr?.abort());
		pendingRequest.current = [];
	};
	const handleResumeUpload = async () => {
		try {
			setUploadState(UPLOAD_STATES.UPLOADING);
			toast.loading('分片上传中...', { id: toastId.current });
			const { uploadedChunks } = await shouldUpload(
				fileHashRef.current,
				file.name
			);
			uploadChunks(chunks, uploadedChunks);
		} catch (err) {
			toast.error(`${err}`, { id: toastId.current });
			setUploadState(UPLOAD_STATES.FAILED);
		}
	};

	const clearFile = () => {
		setFile(null);
		reset();
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

	const showStatus = (percent) => {
		if (percent === 0) {
			return `等待上传...`;
		}
		if (percent === 100) {
			return <CheckCircleFilled />;
		}
		switch (uploadState) {
			case UPLOAD_STATES.PAUSED:
				return `已暂停 [${percent.toFixed(2)}%]`;
			case UPLOAD_STATES.UPLOADING:
				return `上传中 [${percent.toFixed(2)}%]`;
			case UPLOAD_STATES.FAILED:
				return <CloseCircleFilled />;

			default:
				return;
		}
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
						format={showStatus}
						status={
							uploadState === UPLOAD_STATES.FAILED &&
							chunk.percent < 100 &&
							chunk.percent > 0
								? 'exception'
								: ''
						}
						strokeColor={
							uploadState === UPLOAD_STATES.FAILED &&
							chunk.percent < 100 &&
							chunk.percent > 0
								? ''
								: {
										'0%': '#ffc107',
										'100%': '#87d068',
								  }
						}
						style={{ width: '75%' }}
					/>
				</Col>
			</Row>
		));
	};

	const disableSelectFile =
		uploadState === UPLOAD_STATES.HASHING ||
		uploadState === UPLOAD_STATES.PAUSED ||
		uploadState === UPLOAD_STATES.UPLOADING;

	return (
		<>
			<Toaster
				toastOptions={{
					loading: {
						style: {
							background: '#3c3c3c',
							color: '#fff',
						},
					},
				}}
			/>
			<div className='container'>
				<Row gutter={[16, 16]} justify='space-between'>
					<Col>
						<Upload
							beforeUpload={beforeUpload}
							maxCount={1}
							disabled={disableSelectFile}
						>
							<Button
								disabled={disableSelectFile}
								icon={<UploadOutlined />}
							>
								选择文件
							</Button>
						</Upload>
					</Col>
					<Col>
						<Button
							type='primary'
							onClick={upload}
							style={{ marginRight: '8px' }}
							disabled={
								!file ||
								(uploadState !== UPLOAD_STATES.INITIAL &&
									uploadState !== UPLOAD_STATES.FAILED)
							}
						>
							上传
						</Button>
						{(uploadState === UPLOAD_STATES.SUCCESS ||
							uploadState === UPLOAD_STATES.FAILED) && (
							<Button type='primary' onClick={clearFile}>
								清空
							</Button>
						)}
						{uploadState === UPLOAD_STATES.UPLOADING && (
							<Button type='primary' onClick={handlePauseUpload}>
								暂停
							</Button>
						)}
						{uploadState === UPLOAD_STATES.PAUSED && (
							<Button type='primary' onClick={handleResumeUpload}>
								恢复
							</Button>
						)}
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
		</>
	);
}

export default App;
