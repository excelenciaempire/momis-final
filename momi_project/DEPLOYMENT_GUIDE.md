# 🚀 MOMi Project - Guía de Deployment para Producción

## 📋 Estado del Proyecto

**✅ PROYECTO LISTO PARA PRODUCCIÓN**

Todos los problemas críticos han sido resueltos:
- ✅ URLs hardcodeadas de Replit corregidas
- ✅ Variables de entorno configuradas
- ✅ CORS optimizado para producción
- ✅ Configuración de Supabase verificada
- ✅ Arquitectura multi-usuario estable

---

## 🔧 Configuración Requerida

### 1. Variables de Entorno

**Backend (`/backend/.env`):**
```env
# Supabase Configuration
SUPABASE_URL=https://qohvdyqsulzzdtvavpgz.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_key_here

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Server Configuration
PORT=3001
NODE_ENV=production

# Frontend URLs (ajustar según deployment)
FRONTEND_URL=https://yourdomain.com
ADMIN_URL=https://yourdomain.com/admin

# CORS Origins (opcional, para dominios adicionales)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Security
JWT_SECRET=your_jwt_secret_here
ADMIN_SESSION_SECRET=your_admin_session_secret_here
```

**Frontend Registration (`/frontend_registration/.env`):**
```env
REACT_APP_BACKEND_URL=https://api.yourdomain.com
REACT_APP_SUPABASE_URL=https://qohvdyqsulzzdtvavpgz.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvaHZkeXFzdWx6emR0dmF2cGd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc3NjEzNjMsImV4cCI6MjA2MzMzNzM2M30.TzIjwzHoYoyvROii1tzSrbevlunXIafrM2YVMafsXAU
```

**Frontend Admin (`/frontend_admin/.env`):**
```env
REACT_APP_BACKEND_URL=https://api.yourdomain.com
REACT_APP_SUPABASE_URL=https://qohvdyqsulzzdtvavpgz.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvaHZkeXFzdWx6emR0dmF2cGd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc3NjEzNjMsImV4cCI6MjA2MzMzNzM2M30.TzIjwzHoYoyvROii1tzSrbevlunXIafrM2YVMafsXAU
REACT_APP_ADMIN_PATH=/admin
```

**Frontend Widget (`/frontend_widget/.env`):**
```env
REACT_APP_BACKEND_URL=https://api.yourdomain.com
REACT_APP_SUPABASE_URL=https://qohvdyqsulzzdtvavpgz.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvaHZkeXFzdWx6emR0dmF2cGd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc3NjEzNjMsImV4cCI6MjA2MzMzNzM2M30.TzIjwzHoYoyvROii1tzSrbevlunXIafrM2YVMafsXAU
```

---

## 🗄️ Configuración de Supabase

### 1. Scripts SQL Requeridos

Ejecutar en orden en el SQL Editor de Supabase:

1. **Schema principal:** `/backend/sql/schema.sql`
2. **Schema admin:** `/database_schema_admin.sql`
3. **Configuración completa KB:** `/backend/sql/MASTER_KB_SETUP.sql`

### 2. Extensiones Requeridas

En Supabase Dashboard → Database → Extensions:
- ✅ `uuid-ossp` (para generación de UUIDs)
- ✅ `vector` (para embeddings de Knowledge Base)

### 3. Configurar Storage

En Supabase Dashboard → Storage:
- Crear bucket: `knowledge-base-files`
- Políticas: Permitir upload para usuarios autenticados

### 4. Configurar Autenticación

En Supabase Dashboard → Authentication → Settings:
- Confirmar email: Activado
- Configurar dominios permitidos
- Configurar templates de email

---

## 🚀 Deployment por Componente

### Backend (Node.js/Express)

**Opciones recomendadas:**
- **Railway:** Fácil deployment desde GitHub
- **Render:** Plan gratuito disponible
- **DigitalOcean App Platform:** Escalable
- **Vercel:** Para APIs serverless

**Pasos:**
1. Crear repositorio en GitHub
2. Subir código del backend
3. Configurar variables de entorno en plataforma
4. Deploy automático desde GitHub

### Frontend Registration (React)

**Opciones recomendadas:**
- **Vercel:** Óptimo para React
- **Netlify:** Deployment automático
- **Cloudflare Pages:** CDN global

**Pasos:**
1. Build: `cd frontend_registration && npm run build`
2. Upload carpeta `dist/` a plataforma
3. Configurar variables de entorno
4. Configurar redirects para SPA

### Frontend Admin (React)

**Deployment similar al Registration:**
1. Build: `cd frontend_admin && npm run build`
2. Upload a subdirectorio `/admin` o subdominio
3. Configurar autenticación de acceso

### Frontend Widget (React)

**Para embedding en sitios web:**
1. Build: `cd frontend_widget && npm run build`
2. Host en CDN (Cloudflare, AWS CloudFront)
3. Configurar CORS para dominios de clientes

---

## 🔐 Configuración de Seguridad

### Variables Sensibles
```bash
# Generar JWT secret
openssl rand -base64 32

# Generar admin session secret
openssl rand -base64 32
```

### CORS para Producción

El backend está configurado para usar CORS estricto en producción. Agregar dominios en `ALLOWED_ORIGINS`:
```env
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com,https://app.yourdomain.com
```

### Rate Limiting (Recomendado)

Instalar y configurar `express-rate-limit` en backend:
```bash
npm install express-rate-limit
```

---

## 🧪 Testing y Verificación

### Checklist Pre-Production

**Backend:**
- [ ] Todas las variables de entorno configuradas
- [ ] Supabase conecta correctamente
- [ ] OpenAI API funciona
- [ ] Endpoints responden correctamente
- [ ] CORS configurado para dominios de producción

**Frontend Registration:**
- [ ] Login/registro funciona
- [ ] Redirección a chat funciona
- [ ] No hay URLs hardcodeadas de desarrollo

**Frontend Admin:**
- [ ] Dashboard carga estadísticas
- [ ] Gestión de usuarios funciona
- [ ] Knowledge Base admin funciona

**Frontend Widget:**
- [ ] Se carga en sitios externos
- [ ] Chat funciona para usuarios guest
- [ ] Voice messages funcionan

**Supabase:**
- [ ] Todas las tablas creadas
- [ ] Funciones SQL instaladas
- [ ] RLS policies activas
- [ ] Storage configurado

### Testing de Carga

Para múltiples usuarios concurrentes:
```bash
# Instalar herramienta de testing
npm install -g artillery

# Ejecutar test de carga
artillery quick --count 50 --num 10 https://api.yourdomain.com/api/chat/settings
```

---

## 📊 Monitoreo y Logs

### Logs Recomendados

**Backend (agregar middleware):**
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### Métricas a Monitorear

- **Response times** de API endpoints
- **Error rates** por endpoint
- **Concurrent users** activos
- **Knowledge Base** usage stats
- **Supabase** connection pool health

---

## 🚨 Troubleshooting

### Problemas Comunes

**1. CORS Errors:**
```
Access-Control-Allow-Origin header is missing
```
**Solución:** Verificar dominios en `ALLOWED_ORIGINS`

**2. Supabase Connection:**
```
Invalid API key or service_role key
```
**Solución:** Verificar `SUPABASE_SERVICE_KEY` en dashboard

**3. OpenAI API:**
```
Rate limit exceeded or invalid API key
```
**Solución:** Verificar quota y `OPENAI_API_KEY`

**4. Widget Loading:**
```
Script fails to load on external sites
```
**Solución:** Verificar CORS y HTTPS en production

### Debug Mode

Activar logs detallados:
```env
NODE_ENV=development
DEBUG=momi:*
```

---

## 📈 Optimizaciones Post-Deployment

### Performance
- Configurar CDN para assets estáticos
- Implementar caching para responses frecuentes
- Optimizar queries de Supabase
- Comprimir responses (gzip)

### Escalabilidad
- Configurar auto-scaling en plataforma
- Implementar database connection pooling
- Configurar load balancer si necesario
- Monitorear memory usage

### SEO (para sitio principal)
- Configurar meta tags
- Implementar OpenGraph
- Configurar sitemap.xml
- Configurar robots.txt

---

## 🎯 Arquitectura Final

```
[Usuario] → [Frontend Registration] → [Backend API] → [Supabase]
                    ↓
[Usuario] → [Frontend Widget] → [Backend API] → [OpenAI + Supabase]
                    ↓
[Admin] → [Frontend Admin] → [Backend API] → [Supabase Admin Tables]
```

**Dominio sugerido:**
- `app.yourdomain.com` → Frontend Registration
- `admin.yourdomain.com` → Frontend Admin
- `api.yourdomain.com` → Backend API
- `widget.yourdomain.com` → Frontend Widget (para embedding)

---

## ✅ Checklist Final

- [ ] Todas las variables de entorno configuradas
- [ ] Scripts SQL ejecutados en Supabase
- [ ] Todos los componentes deployed
- [ ] CORS configurado correctamente
- [ ] Testing de todos los flujos completado
- [ ] Monitoreo configurado
- [ ] Backup strategy establecida
- [ ] Documentación de usuarios creada

**🎉 ¡Tu plataforma MOMi está lista para producción!**

---

**Soporte:** Para resolver problemas post-deployment, verificar logs en backend y dashboard de Supabase. La arquitectura está diseñada para manejar múltiples usuarios concurrentes con sessions aisladas y alta disponibilidad.