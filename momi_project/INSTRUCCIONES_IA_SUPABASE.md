# 🤖 INSTRUCCIONES PARA IA DE SUPABASE

## 📋 CONTEXTO
Necesitas configurar la base de datos Supabase para el proyecto MOMi, una plataforma de IA conversacional con chat, knowledge base, administración y soporte multi-usuario.

## 🎯 TAREA PRINCIPAL
Ejecutar el script SQL consolidado para crear toda la estructura de base de datos necesaria.

## 📝 INSTRUCCIONES PASO A PASO

### PASO 1: Acceder al SQL Editor
1. Ve a tu proyecto de Supabase
2. En el menú lateral, busca **"SQL Editor"**
3. Haz clic para abrir el editor SQL

### PASO 2: Ejecutar el Script
1. **Archivo a usar:** `SUPABASE_SETUP_COMPLETE.sql`
2. **Acción:** Copia TODO el contenido del archivo
3. **Pegar:** En el SQL Editor de Supabase
4. **Ejecutar:** Haz clic en el botón "Run" (▶️)

### PASO 3: Verificar Resultado
Deberías ver mensajes como:
```
✅ Extensión vector habilitada correctamente
🎉 CONFIGURACIÓN DE SUPABASE COMPLETADA EXITOSAMENTE
✅ Tablas creadas: 12 de 12
✅ Funciones creadas: 5 de 5
✅ Índices creados: [número]
```

### PASO 4: Configurar Storage (OBLIGATORIO)
1. Ve a **Storage** en el menú lateral
2. Haz clic en **"Create bucket"**
3. **Nombre:** `knowledge-base-files`
4. **Configuración:** Público = No (privado)
5. Crea el bucket

### PASO 5: Configurar Políticas de Storage
1. En el bucket `knowledge-base-files`
2. Ve a **"Policies"**
3. Crea estas políticas:

**Política 1 - Upload:**
```sql
CREATE POLICY "Authenticated users can upload" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'knowledge-base-files'
    AND auth.role() = 'authenticated'
);
```

**Política 2 - View:**
```sql
CREATE POLICY "Authenticated users can view" ON storage.objects
FOR SELECT USING (
    bucket_id = 'knowledge-base-files'
    AND auth.role() = 'authenticated'
);
```

**Política 3 - Service Role Full Access:**
```sql
CREATE POLICY "Service role full access" ON storage.objects
FOR ALL USING (
    bucket_id = 'knowledge-base-files'
    AND auth.role() = 'service_role'
);
```

## ✅ QUÉ CREA EL SCRIPT

### 🗄️ Tablas Principales:
- **users** - Usuarios básicos
- **user_profiles** - Perfiles detallados de usuarios
- **guest_users** - Usuarios temporales sin registro
- **conversations** - Conversaciones del chat
- **messages** - Mensajes individuales

### 🧠 Knowledge Base:
- **knowledge_base_documents** - Documentos subidos
- **document_chunks** - Fragmentos con embeddings para RAG
- **kb_analytics** - Estadísticas de uso

### 👨‍💼 Sistema Admin:
- **admin_users** - Administradores del sistema
- **admin_sessions** - Sesiones de admin
- **admin_activity_log** - Registro de actividades

### ⚙️ Configuración:
- **system_settings** - Configuraciones del sistema

### 🔧 Funciones SQL:
- **match_document_chunks** - Búsqueda vectorial para RAG
- **create_admin_session** - Crear sesiones de admin
- **validate_admin_session** - Validar sesiones de admin
- **get_admin_dashboard_stats** - Estadísticas del dashboard
- **track_kb_query** - Analytics de knowledge base

### 🛡️ Seguridad:
- **RLS (Row Level Security)** en todas las tablas
- **Políticas de acceso** configuradas
- **Índices** para optimización

## 🚨 POSIBLES ERRORES Y SOLUCIONES

### Error: "extension vector does not exist"
**Solución:**
1. Ve a **Database** → **Extensions**
2. Busca "vector"
3. Habilita la extensión
4. Vuelve a ejecutar el script

### Error: "permission denied"
**Solución:**
- Asegúrate de tener permisos de administrador en el proyecto
- Verifica que estás en el SQL Editor correcto

### Error: "table already exists"
**Solución:**
- El script tiene `IF NOT EXISTS` - es seguro re-ejecutarlo
- Si quieres empezar limpio, puedes borrar las tablas primero

## 🎯 RESULTADO ESPERADO

Al completar exitosamente:

✅ **12 tablas** creadas con toda la estructura
✅ **Extensiones** vector y uuid-ossp habilitadas
✅ **5 funciones SQL** para operaciones especiales
✅ **Múltiples índices** para optimización
✅ **Políticas RLS** para seguridad
✅ **Configuración inicial** insertada
✅ **Storage bucket** configurado

## 🔄 VARIABLES DE ENTORNO EN REPLIT

Asegúrate de que estas variables estén configuradas en **Secrets** de Replit:

```
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=tu_service_key_aqui
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui
OPENAI_API_KEY=tu_openai_key_aqui
SESSION_SECRET=cualquier_string_largo_aqui
```

## 🎉 FINALIZACIÓN

Una vez completado todo:

1. ✅ **Script SQL ejecutado** sin errores
2. ✅ **Storage configurado** con bucket y políticas
3. ✅ **Variables de entorno** configuradas en Replit
4. ✅ **Proyecto listo** para usar

**🚀 ¡Tu plataforma MOMi estará completamente funcional!**

## 📞 TROUBLESHOOTING

Si encuentras algún error:

1. **Revisa los logs** en el SQL Editor
2. **Verifica extensiones** están habilitadas
3. **Confirma permisos** de administrador
4. **Re-ejecuta** el script (es seguro)

**El script está diseñado para ser re-ejecutable sin problemas.**