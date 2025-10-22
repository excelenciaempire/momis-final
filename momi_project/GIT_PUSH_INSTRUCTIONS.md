# Instrucciones para Push a GitHub

## Estado Actual
- ✅ Todos los cambios están commiteados localmente
- ❌ Necesitamos actualizar las credenciales de GitHub para hacer push

## Opción 1: Usar SSH (Recomendado)

### Paso 1: Configurar SSH Key
```bash
# Generar nueva SSH key (si no tienes una)
ssh-keygen -t ed25519 -C "tu_email@example.com"

# Copiar la clave pública
cat ~/.ssh/id_ed25519.pub
```

### Paso 2: Agregar SSH Key a GitHub
1. Ve a GitHub.com → Settings → SSH and GPG keys
2. Click "New SSH key"
3. Pega la clave pública que copiaste
4. Guarda

### Paso 3: Cambiar Remote a SSH
```bash
cd /home/runner/workspace/momi_project
git remote set-url origin git@github.com:excelenciaempire/momis-final.git
git push origin main
```

---

## Opción 2: Usar Personal Access Token (PAT)

### Paso 1: Crear nuevo Personal Access Token
1. Ve a GitHub.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Dale un nombre descriptivo (ej: "MOMi Project - Replit")
4. Selecciona los permisos:
   - ✅ repo (todos los sub-permisos)
   - ✅ workflow (si usas GitHub Actions)
5. Click "Generate token"
6. **COPIA EL TOKEN INMEDIATAMENTE** (no podrás verlo de nuevo)

### Paso 2: Configurar Git con el nuevo token
```bash
cd /home/runner/workspace/momi_project

# Reemplaza YOUR_NEW_TOKEN con tu token real
git remote set-url origin https://YOUR_NEW_TOKEN@github.com/excelenciaempire/momis-final.git

# Hacer push
git push origin main
```

---

## Opción 3: Push Manual desde tu Máquina Local

Si estás trabajando en Replit y tienes problemas con las credenciales:

```bash
# En tu máquina local, clonar el repo
git clone https://github.com/excelenciaempire/momis-final.git
cd momis-final

# Agregar el remote de Replit
git remote add replit https://your-replit-url

# Obtener los cambios de Replit
git fetch replit
git merge replit/main

# Push a GitHub
git push origin main
```

---

## Verificar que el Push Funcionó

Después de hacer push exitosamente:
```bash
git status
# Debería decir: "Your branch is up to date with 'origin/main'"

git log --oneline -5
# Deberías ver tu último commit en la lista
```

---

## Resumen del Commit que se Subirá

**Commit Message:**
```
Fix: Display real user names and emails in Conversations Management

- Modified /admin/conversations endpoint to JOIN with user_profiles table
- Now displays first_name + last_name instead of 'User {id}'
- Shows real email addresses instead of placeholder 'user@example.com'
- Updated getPersonalizedWelcomeMessage() to fetch from system_settings
- Welcome message now reflects Admin Dashboard configuration
```

**Archivos Modificados:**
- backend/index.js
- backend/utils/buildSystemPrompt.js
- backend/routes/chat.js
- frontend_registration/src/pages/ChatPage.jsx
- backend/scripts/init_opening_message.js (nuevo)
- backend/sql/init_opening_message.sql (nuevo)
- WELCOME_MESSAGE_FIX.md (nuevo)

---

## Troubleshooting

### Error: "Authentication failed"
- Tu token ha expirado o no tiene los permisos correctos
- Genera un nuevo token con permisos de `repo`

### Error: "Permission denied (publickey)"
- Tu SSH key no está configurada correctamente
- Asegúrate de haber agregado tu clave pública a GitHub

### Error: "Could not resolve host"
- Problema de conectividad
- Verifica tu conexión a internet

