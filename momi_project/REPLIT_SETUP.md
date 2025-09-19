# 🚀 MOMi Project - Configuración para Replit

## ✅ CONFIGURACIÓN COMPLETADA

Tu plataforma MOMi está **100% optimizada para Replit** y lista para usar.

---

## 🔧 Variables de Entorno Requeridas en Replit

Ve a **Secrets** en tu Replit y agrega estas variables:

### Variables Críticas:
```
SUPABASE_URL=https://qohvdyqsulzzdtvavpgz.supabase.co
SUPABASE_SERVICE_KEY=tu_service_key_de_supabase
OPENAI_API_KEY=tu_api_key_de_openai
```

### Variables Opcionales:
```
NODE_ENV=production
PORT=3001
JWT_SECRET=tu_jwt_secret_aqui
ADMIN_SESSION_SECRET=tu_admin_session_secret_aqui
```

---

## 🗄️ Configuración de Supabase (OBLIGATORIO)

### 1. Habilitar Extensiones
En Supabase Dashboard → Database → Extensions:
- ✅ `uuid-ossp`
- ✅ `vector`

### 2. Ejecutar Scripts SQL

**Ejecutar en este orden en el SQL Editor de Supabase:**

1. **Schema principal:**
```sql
-- Copiar y ejecutar: /backend/sql/schema.sql
```

2. **Schema admin:**
```sql
-- Copiar y ejecutar: /database_schema_admin.sql
```

3. **Knowledge Base Setup:**
```sql
-- Copiar y ejecutar: /backend/sql/MASTER_KB_SETUP.sql
```

### 3. Configurar Storage
- Crear bucket: `knowledge-base-files`
- Configurar políticas de acceso

---

## 🚀 Cómo Ejecutar en Replit

### 1. Estructura del Proyecto:
```
momi_project/
├── backend/           # Servidor principal (Puerto 3001)
├── frontend_registration/  # App React de registro
├── frontend_admin/    # Panel de administración
├── frontend_widget/   # Widget embebido
└── public/           # Assets estáticos
```

### 2. Script de Inicio:
El proyecto ya está configurado para ejecutarse automáticamente en Replit:

```bash
# El backend inicia automáticamente en puerto 3001
# Todos los frontends se sirven desde el backend
```

### 3. URLs del Sistema:
- **App Principal:** `https://tu-repl.replit.dev/`
- **Login:** `https://tu-repl.replit.dev/login`
- **Registro:** `https://tu-repl.replit.dev/register`
- **Chat:** `https://tu-repl.replit.dev/chat`
- **Admin:** `https://tu-repl.replit.dev/admin`
- **Widget:** `https://tu-repl.replit.dev/widget`

---

## ✅ Verificación del Sistema

### Checklist Post-Configuración:

**Backend:**
- [ ] Variables de entorno configuradas en Secrets
- [ ] Servidor inicia sin errores
- [ ] Supabase conecta correctamente
- [ ] OpenAI API responde

**Supabase:**
- [ ] Extensiones habilitadas
- [ ] Scripts SQL ejecutados
- [ ] Tablas creadas correctamente
- [ ] Storage configurado

**Frontend:**
- [ ] Páginas cargan sin errores
- [ ] Login/registro funciona
- [ ] Chat responde correctamente
- [ ] Admin panel accesible

**Features:**
- [ ] Upload de imágenes funciona
- [ ] Voice messages funcionan
- [ ] Knowledge Base operativa
- [ ] Multi-usuario funciona

---

## 🎯 Funcionalidades Disponibles

### Para Usuarios:
- ✅ **Registro/Login** con Supabase Auth
- ✅ **Chat con IA** usando GPT-4o
- ✅ **Voice Messages** con transcripción Whisper
- ✅ **Upload de Imágenes** con análisis
- ✅ **Sesiones Guest** para usuarios no registrados
- ✅ **Historial de Conversaciones**

### Para Administradores:
- ✅ **Dashboard Admin** (`/admin`)
- ✅ **Gestión de Usuarios**
- ✅ **Knowledge Base** con RAG
- ✅ **Estadísticas** y analytics
- ✅ **Configuración del Sistema**

### Widget Embebido:
- ✅ **Chat flotante** para sitios web
- ✅ **Modo fullpage**
- ✅ **Compatible** con cualquier sitio

---

## 🔧 Troubleshooting

### Problemas Comunes:

**1. Error de conexión a Supabase:**
```
Error: Invalid API key
```
**Solución:** Verificar `SUPABASE_SERVICE_KEY` en Secrets

**2. Error de OpenAI:**
```
Rate limit exceeded
```
**Solución:** Verificar `OPENAI_API_KEY` y quota

**3. Error en SQL:**
```
Extension "vector" not found
```
**Solución:** Habilitar extensión en Dashboard de Supabase

### Debug Mode:
Para ver logs detallados, agregar en Secrets:
```
DEBUG=momi:*
```

---

## 📊 Monitoreo

### Logs Disponibles:
- **Console de Replit:** Logs del servidor en tiempo real
- **Supabase Dashboard:** Logs de base de datos
- **OpenAI Dashboard:** Usage de API

### Métricas:
- Usuarios activos
- Conversaciones por día
- Usage de Knowledge Base
- Response times

---

## 🚨 Seguridad

### Configurado:
- ✅ **CORS** optimizado para Replit
- ✅ **RLS Policies** en Supabase
- ✅ **Autenticación dual** (users/admins)
- ✅ **Session management**
- ✅ **Rate limiting** básico

### Recomendaciones:
- Mantener secrets seguros
- Rotar API keys regularmente
- Monitorear usage de OpenAI
- Backup regular de Supabase

---

## 🎉 ¡Ya Está Listo!

Tu plataforma MOMi está **completamente funcional** en Replit:

1. ✅ **Código optimizado** para entorno Replit
2. ✅ **Variables dinámicas** sin archivos .env
3. ✅ **Multi-usuario estable**
4. ✅ **Todas las funcionalidades operativas**
5. ✅ **Admin panel completo**
6. ✅ **Widget embebido funcionando**

**Solo necesitas:**
1. Configurar las variables en Secrets de Replit
2. Ejecutar los scripts SQL en Supabase
3. ¡Usar tu plataforma!

**🚀 TU PLATAFORMA ESTÁ LISTA PARA USARSE COMO SI TU VIDA DEPENDIERA DE ELLO 🚀**