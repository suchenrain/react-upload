import './App.css';
import { Upload, Button, Space, Row } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { request } from './request';

function App() {
	const [file, setFile] = useState(null);
	const [chunks, setChunks] = useState([]);
	const CHUNK_COUNT = 10;

	const beforeUpload = (file) => {
		setFile(file);
		return false;
	};

	const upload = async () => {
		if (!file) return;
		const fileChunkList = createChunks(file);
		const chunkArr = fileChunkList.map(({ fileChunk }, index) => ({
			chunk: fileChunk,
			hash: `${file.name}-${index}`,
		}));
		setChunks(chunkArr)
		await uploadChunks();
	};

	const mergeRequest = async () => {
		await request({
			url: 'http://localhost:8080/merge',
			headers: {
				'content-type': 'application/json',
			},
			data: JSON.stringify({
				fileName: file.name,
			}),
		});
	};

	const uploadChunks = async () => {
		let reqList = chunks
			.map(({ chunk, hash }) => {
				let formData = new FormData();
				formData.append('chunk', chunk);
				formData.append('hash', hash);
				formData.append('filename', file.name);
				return { formData };
			})
			.map(async ({ formData }) => {
				request({ url: 'http://localhost:8080', data: formData });
			});

		// 发送切片
		await Promise.all(reqList)

		// 发送合并请求
		// await mergeRequest();
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

	return (
		<Row justify='center'>
			<Space size='large' align='start'>
				<Upload beforeUpload={beforeUpload} maxCount={1}>
					<Button icon={<UploadOutlined />}>选择文件</Button>
				</Upload>
				<Button type='primary' onClick={upload} disabled={!file}>
					上传
				</Button>
			</Space>
		</Row>
	);
}

export default App;
