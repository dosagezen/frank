export interface ConhecimentoItem {
  id: number;
  titulo: string;
  descricao: string;
  link: string;
  thumbnail: string;
  autor: string;
  dataPublicacao: string;
  visualizado: boolean;
  visualizacoes: number;
  tags: string[];
}

export const conhecimentoMock: ConhecimentoItem[] = [
  {
    id: 1,
    titulo: 'Scrum em 10 Minutos - Guia Completo e Prático',
    descricao: 'Aprenda os fundamentos do Scrum de forma rápida e objetiva. Este vídeo apresenta os papéis, eventos e artefatos do framework ágil mais utilizado no mundo. Ideal para quem está começando ou precisa revisar os conceitos principais.',
    link: 'https://www.youtube.com/watch?v=XfvQWnRgxG0',
    thumbnail: 'https://readdy.ai/api/search-image?query=Modern%20professional%20thumbnail%20image%20showing%20Scrum%20agile%20methodology%20concept%20with%20colorful%20sticky%20notes%20sprint%20board%20team%20collaboration%20elements%20clean%20workspace%20background%20bright%20natural%20lighting%20corporate%20training%20style%20high%20quality%20photography&width=320&height=180&seq=scrum-thumbnail-001&orientation=landscape',
    autor: 'Carlos Santos',
    dataPublicacao: '15/03/2024',
    visualizado: false,
    visualizacoes: 0,
    tags: ['Scrum', 'Metodologia Ágil', 'Gestão de Projetos']
  },
  {
    id: 2,
    titulo: 'Daily Scrum - Como Fazer a Reunião Diária Corretamente',
    descricao: 'Descubra como conduzir uma Daily Scrum eficiente e produtiva. Aprenda as melhores práticas, erros comuns a evitar e como manter a equipe alinhada em apenas 15 minutos por dia.',
    link: 'https://www.youtube.com/watch?v=v2L_pHRc5Ro',
    thumbnail: 'https://readdy.ai/api/search-image?query=Professional%20team%20meeting%20image%20with%20diverse%20group%20standing%20around%20digital%20board%20discussing%20daily%20scrum%20modern%20office%20environment%20natural%20morning%20lighting%20collaboration%20atmosphere%20high%20quality%20corporate%20photography&width=320&height=180&seq=daily-scrum-thumbnail-002&orientation=landscape',
    autor: 'Ana Silva',
    dataPublicacao: '12/03/2024',
    visualizado: true,
    visualizacoes: 8,
    tags: ['Scrum', 'Daily Scrum', 'Reuniões']
  },
  {
    id: 3,
    titulo: 'Sprint Planning - Planejamento de Sprint na Prática',
    descricao: 'Tutorial completo sobre como fazer um Sprint Planning efetivo. Aprenda a definir o Sprint Goal, estimar histórias de usuário e criar um plano de sprint realista e alcançável.',
    link: 'https://www.youtube.com/watch?v=2A9rkiIcnVI',
    thumbnail: 'https://readdy.ai/api/search-image?query=Sprint%20planning%20meeting%20scene%20with%20team%20members%20around%20table%20pointing%20at%20large%20screen%20showing%20backlog%20items%20sticky%20notes%20colorful%20markers%20modern%20collaborative%20workspace%20bright%20lighting%20professional%20business%20photography&width=320&height=180&seq=sprint-planning-003&orientation=landscape',
    autor: 'Mariana Costa',
    dataPublicacao: '10/03/2024',
    visualizado: false,
    visualizacoes: 0,
    tags: ['Scrum', 'Sprint Planning', 'Planejamento']
  },
  {
    id: 4,
    titulo: 'Retrospectiva Ágil - Técnicas e Dinâmicas',
    descricao: 'Conheça diversas técnicas e dinâmicas para conduzir retrospectivas ágeis engajantes e produtivas. Aprenda a criar um ambiente seguro para feedback e melhoria contínua.',
    link: 'https://www.youtube.com/watch?v=TtJuvEb0IqE',
    thumbnail: 'https://readdy.ai/api/search-image?query=Agile%20retrospective%20meeting%20image%20with%20team%20members%20writing%20on%20colorful%20sticky%20notes%20whiteboard%20divided%20in%20sections%20happy%20sad%20learning%20modern%20office%20space%20collaborative%20atmosphere%20natural%20lighting%20professional%20photography&width=320&height=180&seq=retrospective-004&orientation=landscape',
    autor: 'Pedro Oliveira',
    dataPublicacao: '08/03/2024',
    visualizado: true,
    visualizacoes: 12,
    tags: ['Scrum', 'Retrospectiva', 'Melhoria Contínua']
  },
  {
    id: 5,
    titulo: 'Product Backlog - Como Criar e Gerenciar',
    descricao: 'Guia completo sobre Product Backlog: como criar, priorizar e manter um backlog saudável. Aprenda técnicas de refinamento e as responsabilidades do Product Owner.',
    link: 'https://www.youtube.com/watch?v=9i-z5AhU8DU',
    thumbnail: 'https://readdy.ai/api/search-image?query=Product%20backlog%20management%20image%20showing%20organized%20list%20of%20user%20stories%20on%20digital%20screen%20colorful%20priority%20tags%20person%20reviewing%20items%20laptop%20workspace%20clean%20desk%20modern%20office%20lighting%20professional%20business%20photography&width=320&height=180&seq=product-backlog-005&orientation=landscape',
    autor: 'Rafael Lima',
    dataPublicacao: '05/03/2024',
    visualizado: false,
    visualizacoes: 0,
    tags: ['Scrum', 'Product Backlog', 'Product Owner']
  },
  {
    id: 6,
    titulo: 'User Stories - Como Escrever Histórias de Usuário Eficazes',
    descricao: 'Aprenda a arte de escrever user stories que realmente agregam valor. Descubra o formato correto, critérios de aceitação e como dividir histórias grandes em menores.',
    link: 'https://www.youtube.com/watch?v=LGeDZmrWwsw',
    thumbnail: 'https://readdy.ai/api/search-image?query=User%20story%20card%20template%20image%20showing%20structured%20format%20with%20persona%20needs%20and%20benefits%20written%20on%20index%20cards%20colorful%20markers%20clean%20white%20background%20organized%20layout%20professional%20training%20material%20style&width=320&height=180&seq=user-stories-006&orientation=landscape',
    autor: 'Julia Ferreira',
    dataPublicacao: '03/03/2024',
    visualizado: true,
    visualizacoes: 15,
    tags: ['User Stories', 'Requisitos', 'Metodologia Ágil']
  },
  {
    id: 7,
    titulo: 'Kanban vs Scrum - Qual Escolher?',
    descricao: 'Comparação detalhada entre Kanban e Scrum. Entenda as diferenças, vantagens e desvantagens de cada framework e saiba qual se adequa melhor ao seu contexto.',
    link: 'https://www.youtube.com/watch?v=rIaz-l1Kf8w',
    thumbnail: 'https://readdy.ai/api/search-image?query=Split%20screen%20comparison%20image%20showing%20Kanban%20board%20on%20left%20side%20with%20flowing%20columns%20and%20Scrum%20sprint%20board%20on%20right%20side%20with%20timeboxed%20sprints%20visual%20contrast%20modern%20digital%20boards%20clean%20professional%20educational%20design&width=320&height=180&seq=kanban-vs-scrum-007&orientation=landscape',
    autor: 'Carlos Santos',
    dataPublicacao: '28/02/2024',
    visualizado: false,
    visualizacoes: 0,
    tags: ['Kanban', 'Scrum', 'Metodologia Ágil', 'Comparação']
  },
  {
    id: 8,
    titulo: 'Definition of Done - Definindo o Pronto',
    descricao: 'Entenda a importância da Definition of Done e como criar uma DoD eficaz para sua equipe. Garanta qualidade e transparência nas entregas do seu time.',
    link: 'https://www.youtube.com/watch?v=eU6szh_CFDs',
    thumbnail: 'https://readdy.ai/api/search-image?query=Definition%20of%20done%20checklist%20image%20with%20completed%20checkmarks%20quality%20criteria%20testing%20deployment%20steps%20clean%20whiteboard%20professional%20team%20workspace%20organized%20layout%20modern%20office%20style%20high%20quality%20photography&width=320&height=180&seq=definition-done-008&orientation=landscape',
    autor: 'Ana Silva',
    dataPublicacao: '25/02/2024',
    visualizado: true,
    visualizacoes: 6,
    tags: ['Scrum', 'Qualidade', 'Definition of Done']
  },
  {
    id: 9,
    titulo: 'Estimativas Ágeis - Planning Poker e Outras Técnicas',
    descricao: 'Domine as técnicas de estimativa ágil, incluindo Planning Poker, T-Shirt Sizing e Story Points. Aprenda como estimar de forma colaborativa e realista.',
    link: 'https://www.youtube.com/watch?v=Hwu444eM37w',
    thumbnail: 'https://readdy.ai/api/search-image?query=Planning%20poker%20cards%20image%20showing%20Fibonacci%20sequence%20cards%20spread%20on%20table%20team%20hands%20reaching%20for%20cards%20collaborative%20estimation%20session%20colorful%20cards%20modern%20office%20bright%20lighting%20professional%20workshop%20photography&width=320&height=180&seq=planning-poker-009&orientation=landscape',
    autor: 'Mariana Costa',
    dataPublicacao: '22/02/2024',
    visualizado: false,
    visualizacoes: 0,
    tags: ['Estimativas', 'Planning Poker', 'Scrum']
  },
  {
    id: 10,
    titulo: 'Scrum Master - Papel e Responsabilidades',
    descricao: 'Conheça em profundidade o papel do Scrum Master. Descubra como facilitar o processo, remover impedimentos e ajudar a equipe a alcançar alta performance.',
    link: 'https://www.youtube.com/watch?v=zexU8xErDqM',
    thumbnail: 'https://readdy.ai/api/search-image?query=Scrum%20Master%20facilitating%20team%20image%20showing%20person%20leading%20collaborative%20discussion%20pointing%20at%20board%20team%20engaged%20in%20conversation%20modern%20office%20environment%20supportive%20atmosphere%20professional%20leadership%20photography&width=320&height=180&seq=scrum-master-010&orientation=landscape',
    autor: 'Pedro Oliveira',
    dataPublicacao: '20/02/2024',
    visualizado: true,
    visualizacoes: 20,
    tags: ['Scrum Master', 'Liderança', 'Scrum']
  },
  {
    id: 11,
    titulo: 'Git e GitHub para Iniciantes - Tutorial Completo',
    descricao: 'Aprenda os fundamentos do controle de versão com Git e GitHub. Desde a instalação até comandos avançados, branches, merges e pull requests.',
    link: 'https://www.youtube.com/watch?v=UBAX-13g8OM',
    thumbnail: 'https://readdy.ai/api/search-image?query=Git%20GitHub%20tutorial%20image%20with%20laptop%20screen%20showing%20repository%20interface%20branching%20diagram%20colorful%20code%20editor%20dark%20theme%20modern%20developer%20workspace%20professional%20technical%20photography&width=320&height=180&seq=git-github-011&orientation=landscape',
    autor: 'Rafael Lima',
    dataPublicacao: '18/02/2024',
    visualizado: false,
    visualizacoes: 0,
    tags: ['Git', 'GitHub', 'Controle de Versão', 'Desenvolvimento']
  },
  {
    id: 12,
    titulo: 'Figma para Desenvolvedores - Design System na Prática',
    descricao: 'Tutorial prático de Figma focado em desenvolvedores. Aprenda a trabalhar com componentes, variáveis, auto-layout e a extrair especificações de design.',
    link: 'https://www.youtube.com/watch?v=Cx2dkpBxst8',
    thumbnail: 'https://readdy.ai/api/search-image?query=Figma%20design%20system%20interface%20screenshot%20showing%20component%20library%20colorful%20UI%20elements%20organized%20grid%20layout%20modern%20design%20tool%20professional%20screen%20capture%20clean%20interface%20high%20resolution&width=320&height=180&seq=figma-tutorial-012&orientation=landscape',
    autor: 'Ana Silva',
    dataPublicacao: '15/02/2024',
    visualizado: true,
    visualizacoes: 9,
    tags: ['Figma', 'Design System', 'UI/UX', 'Ferramentas']
  },
  {
    id: 13,
    titulo: 'TypeScript para Iniciantes - Do Zero ao Avançado',
    descricao: 'Curso completo de TypeScript cobrindo desde tipos básicos até generics, decorators e patterns avançados. Aprenda a escrever código JavaScript mais seguro e escalável.',
    link: 'https://www.youtube.com/watch?v=qy5yXYyYxvU',
    thumbnail: 'https://readdy.ai/api/search-image?query=TypeScript%20programming%20tutorial%20image%20showing%20code%20editor%20with%20TypeScript%20syntax%20highlighting%20blue%20TS%20logo%20type%20annotations%20clean%20dark%20theme%20professional%20developer%20screen%20modern%20workspace&width=320&height=180&seq=typescript-013&orientation=landscape',
    autor: 'Lucas Mendes',
    dataPublicacao: '12/02/2024',
    visualizado: false,
    visualizacoes: 0,
    tags: ['TypeScript', 'Programação', 'JavaScript', 'Desenvolvimento']
  },
  {
    id: 14,
    titulo: 'React Hooks Completo - useState, useEffect e Mais',
    descricao: 'Domine todos os React Hooks essenciais. Aprenda useState, useEffect, useContext, useReducer, useMemo e useCallback com exemplos práticos e casos de uso reais.',
    link: 'https://www.youtube.com/watch?v=TNhaISOUy6Q',
    thumbnail: 'https://readdy.ai/api/search-image?query=React%20Hooks%20tutorial%20image%20showing%20code%20editor%20with%20React%20hooks%20examples%20useState%20useEffect%20colorful%20syntax%20highlighting%20React%20logo%20modern%20developer%20workspace%20dark%20theme%20professional%20coding%20screenshot&width=320&height=180&seq=react-hooks-014&orientation=landscape',
    autor: 'Beatriz Rocha',
    dataPublicacao: '08/02/2024',
    visualizado: true,
    visualizacoes: 18,
    tags: ['React', 'Hooks', 'Frontend', 'Desenvolvimento']
  },
  {
    id: 15,
    titulo: 'CSS Grid e Flexbox - Layout Responsivo Moderno',
    descricao: 'Aprenda a criar layouts responsivos e profissionais usando CSS Grid e Flexbox. Técnicas modernas, truques e boas práticas para designs adaptativos.',
    link: 'https://www.youtube.com/watch?v=K74l26pE4YA',
    thumbnail: 'https://readdy.ai/api/search-image?query=CSS%20Grid%20Flexbox%20layout%20tutorial%20image%20showing%20responsive%20grid%20layout%20colorful%20boxes%20aligned%20modern%20web%20design%20browser%20window%20code%20editor%20split%20view%20professional%20web%20development%20screenshot&width=320&height=180&seq=css-grid-flexbox-015&orientation=landscape',
    autor: 'Fernando Alves',
    dataPublicacao: '05/02/2024',
    visualizado: false,
    visualizacoes: 0,
    tags: ['CSS', 'Layout', 'Frontend', 'Responsivo']
  },
  {
    id: 16,
    titulo: 'Node.js e Express - Criando APIs RESTful',
    descricao: 'Construa APIs RESTful robustas com Node.js e Express. Aprenda sobre rotas, middlewares, autenticação JWT, validação de dados e boas práticas de arquitetura.',
    link: 'https://www.youtube.com/watch?v=Oe421EPjeBE',
    thumbnail: 'https://readdy.ai/api/search-image?query=Node.js%20Express%20API%20tutorial%20image%20showing%20code%20editor%20with%20Express%20routes%20middleware%20setup%20green%20Node.js%20logo%20API%20endpoints%20postman%20testing%20professional%20backend%20development%20workspace&width=320&height=180&seq=nodejs-express-016&orientation=landscape',
    autor: 'Gabriel Martins',
    dataPublicacao: '01/02/2024',
    visualizado: true,
    visualizacoes: 14,
    tags: ['Node.js', 'Express', 'Backend', 'API', 'Desenvolvimento']
  },
  {
    id: 17,
    titulo: 'Docker para Desenvolvedores - Containerização Completa',
    descricao: 'Aprenda Docker do básico ao avançado. Crie containers, gerencie imagens, trabalhe com Docker Compose e entenda como containerizar suas aplicações.',
    link: 'https://www.youtube.com/watch?v=3c-iBn73dDE',
    thumbnail: 'https://readdy.ai/api/search-image?query=Docker%20containerization%20tutorial%20image%20showing%20Docker%20whale%20logo%20multiple%20containers%20connected%20blue%20theme%20terminal%20commands%20docker%20compose%20yaml%20file%20modern%20DevOps%20workspace%20professional%20technical%20photography&width=320&height=180&seq=docker-tutorial-017&orientation=landscape',
    autor: 'Amanda Ribeiro',
    dataPublicacao: '28/01/2024',
    visualizado: false,
    visualizacoes: 0,
    tags: ['Docker', 'DevOps', 'Containers', 'Infraestrutura']
  },
  {
    id: 18,
    titulo: 'MongoDB - Banco de Dados NoSQL na Prática',
    descricao: 'Tutorial completo de MongoDB. Aprenda queries, agregações, indexação, modelagem de dados e como integrar MongoDB com Node.js em projetos reais.',
    link: 'https://www.youtube.com/watch?v=ofme2o29ngU',
    thumbnail: 'https://readdy.ai/api/search-image?query=MongoDB%20NoSQL%20database%20tutorial%20image%20showing%20MongoDB%20compass%20interface%20green%20leaf%20logo%20JSON%20documents%20data%20collections%20modern%20database%20management%20screen%20professional%20technical%20workspace&width=320&height=180&seq=mongodb-tutorial-018&orientation=landscape',
    autor: 'Thiago Souza',
    dataPublicacao: '25/01/2024',
    visualizado: true,
    visualizacoes: 11,
    tags: ['MongoDB', 'NoSQL', 'Banco de Dados', 'Backend']
  },
  {
    id: 19,
    titulo: 'TDD - Test Driven Development com Jest',
    descricao: 'Aprenda Test Driven Development na prática usando Jest. Entenda os ciclos Red-Green-Refactor, mocks, spies e como escrever testes eficazes.',
    link: 'https://www.youtube.com/watch?v=Jv2uxzhPFl4',
    thumbnail: 'https://readdy.ai/api/search-image?query=Test%20Driven%20Development%20TDD%20image%20showing%20Jest%20testing%20framework%20code%20editor%20with%20test%20cases%20green%20checkmarks%20passing%20tests%20red%20fail%20indicators%20modern%20developer%20workspace%20professional%20coding%20screenshot&width=320&height=180&seq=tdd-jest-019&orientation=landscape',
    autor: 'Carolina Dias',
    dataPublicacao: '22/01/2024',
    visualizado: false,
    visualizacoes: 0,
    tags: ['TDD', 'Testes', 'Jest', 'Qualidade', 'Desenvolvimento']
  },
  {
    id: 20,
    titulo: 'Clean Code - Código Limpo e Legível',
    descricao: 'Aprenda os princípios de Clean Code do Uncle Bob. Escreva código mais legível, manutenível e profissional seguindo as melhores práticas da indústria.',
    link: 'https://www.youtube.com/watch?v=7EmboKQH8lM',
    thumbnail: 'https://readdy.ai/api/search-image?query=Clean%20Code%20principles%20image%20showing%20well%20organized%20code%20structure%20before%20after%20comparison%20readable%20naming%20conventions%20professional%20code%20editor%20modern%20software%20craftsmanship%20concept%20high%20quality%20photography&width=320&height=180&seq=clean-code-020&orientation=landscape',
    autor: 'Roberto Cunha',
    dataPublicacao: '18/01/2024',
    visualizado: true,
    visualizacoes: 25,
    tags: ['Clean Code', 'Boas Práticas', 'Qualidade', 'Desenvolvimento']
  },
  {
    id: 21,
    titulo: 'CI/CD com GitHub Actions - Deploy Automatizado',
    descricao: 'Configure pipelines de CI/CD usando GitHub Actions. Aprenda a automatizar testes, builds e deploys, garantindo entregas contínuas e confiáveis.',
    link: 'https://www.youtube.com/watch?v=R8_veQiYBjI',
    thumbnail: 'https://readdy.ai/api/search-image?query=CI%20CD%20pipeline%20GitHub%20Actions%20image%20showing%20workflow%20automation%20green%20checkmarks%20build%20deploy%20stages%20modern%20DevOps%20dashboard%20professional%20automated%20deployment%20process%20high%20quality%20technical%20photography&width=320&height=180&seq=cicd-github-actions-021&orientation=landscape',
    autor: 'Isabela Nunes',
    dataPublicacao: '15/01/2024',
    visualizado: false,
    visualizacoes: 0,
    tags: ['CI/CD', 'GitHub Actions', 'DevOps', 'Automação']
  }
];
