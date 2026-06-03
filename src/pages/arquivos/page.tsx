import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';

interface FileItem {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  url: string;
  uploaded_at: string;
  project_id: string | null;
  task_id: string | null;
  projectName?: string;
  taskName?: string;
}

export default function ArquivosPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterProject, setFilterProject] = useState('all');

  const loadFiles = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data: filesData, error: filesError } = await supabase
        .from('files')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (filesError) {
        console.error('Erro ao carregar arquivos:', filesError);
        setFiles([]);
        return;
      }

      if (!filesData || filesData.length === 0) {
        setFiles([]);
        return;
      }

      setFiles(filesData);
    } catch (error) {
      console.error('Erro inesperado:', error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleDownload = async (file: FileItem) => {
    try {
      const { data, error } = await supabase.storage
        .from('project-files')
        .download(file.url);

      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.nome;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Erro ao baixar arquivo:', error);
      alert('Erro ao baixar arquivo. Tente novamente.');
    }
  };

  const filteredFiles = files.filter((file) => {
    const matchesSearch = file.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ?? true;
    const matchesType = filterType === 'all' || file.tipo === filterType;
    const matchesProject = filterProject === 'all' || file.project_id === filterProject;
    return matchesSearch && matchesType && matchesProject;
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getFileIcon = (tipo: string | null | undefined) => {
    if (!tipo) return 'ri-file-line';
    const tipoLower = tipo.toLowerCase();
    if (tipoLower.includes('pdf')) return 'ri-file-pdf-line';
    if (tipoLower.includes('word') || tipoLower.includes('document')) return 'ri-file-word-line';
    if (tipoLower.includes('excel') || tipoLower.includes('spreadsheet')) return 'ri-file-excel-line';
    if (tipoLower.includes('image')) return 'ri-image-line';
    if (tipoLower.includes('video')) return 'ri-video-line';
    return 'ri-file-line';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <i className="ri-loader-4-line text-4xl text-teal-600 dark:text-teal-400 animate-spin mb-4"></i>
          <p className="text-gray-600 dark:text-gray-400">Carregando arquivos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>Arquivos</h1>
        <p className="text-gray-600 dark:text-gray-400" style={{ fontFamily: 'Inter, sans-serif' }}>Gerencie todos os arquivos do projeto</p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Buscar</label>
            <div className="relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input type="text" placeholder="Buscar arquivos..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tipo de Arquivo</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer">
              <option value="all">Todos os tipos</option>
              <option value="application/pdf">PDF</option>
              <option value="image">Imagens</option>
              <option value="document">Documentos</option>
              <option value="spreadsheet">Planilhas</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Projeto</label>
            <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer">
              <option value="all">Todos os projetos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Files Grid */}
      {filteredFiles.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <i className="ri-folder-open-line text-6xl text-gray-300 dark:text-gray-600 mb-4"></i>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Nenhum arquivo encontrado</h3>
          <p className="text-gray-600 dark:text-gray-400">{searchTerm || filterType !== 'all' || filterProject !== 'all' ? 'Tente ajustar os filtros de busca' : 'Faça upload de arquivos para começar'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFiles.map((file) => (
            <div key={file.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="w-12 h-12 bg-teal-50 dark:bg-teal-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <i className={`${getFileIcon(file.tipo)} text-2xl text-teal-600 dark:text-teal-400`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">{file.nome}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{formatFileSize(file.tamanho)}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400"><i className="ri-calendar-line mr-2"></i>{new Date(file.uploaded_at).toLocaleDateString('pt-BR')}</div>
                {file.projectName && <div className="flex items-center text-sm text-gray-600 dark:text-gray-400"><i className="ri-folder-line mr-2"></i>{file.projectName}</div>}
                {file.taskName && <div className="flex items-center text-sm text-gray-600 dark:text-gray-400"><i className="ri-task-line mr-2"></i>{file.taskName}</div>}
              </div>
              <button onClick={() => handleDownload(file)} className="w-full px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center justify-center space-x-2 whitespace-nowrap cursor-pointer">
                <i className="ri-download-line"></i><span>Baixar arquivo</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}