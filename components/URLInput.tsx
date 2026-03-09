'use client';

import { useState } from 'react';

interface Props {
  onSubmit: (data: {
    url: string;
    description: string;
    auth?: { loginUrl: string; username: string; password: string };
  }) => void;
  isLoading: boolean;
}

export default function URLInput({ onSubmit, isLoading }: Props) {
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [needAuth, setNeedAuth] = useState(false);
  const [loginUrl, setLoginUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      url,
      description,
      auth: needAuth ? { loginUrl, username, password } : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-5 space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">测试配置</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">目标 URL</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/products"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">功能描述</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="例如：测试新增产品功能，填写产品名称和标签后提交"
          required
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={needAuth}
            onChange={(e) => setNeedAuth(e.target.checked)}
            className="rounded"
          />
          需要登录认证
        </label>
      </div>

      {needAuth && (
        <div className="space-y-3 p-3 bg-gray-50 rounded-md">
          <div>
            <label className="block text-sm text-gray-600 mb-1">登录页 URL</label>
            <input
              type="url"
              value={loginUrl}
              onChange={(e) => setLoginUrl(e.target.value)}
              placeholder="https://example.com/login"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !url || !description}
        className="w-full py-2.5 px-4 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
      >
        {isLoading ? '分析中...' : '开始生成测试'}
      </button>
    </form>
  );
}
