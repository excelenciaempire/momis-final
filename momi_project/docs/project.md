# Proyecto MOMi: Especificación Funcional Completa

## 1. Visión General del Proyecto

**Nombre del Proyecto:** MOMIs

**Objetivo Principal:** Desarrollar un chatbot (MOMi) impulsado por inteligencia artificial (OpenAI) que ofrezca apoyo empático, información de bienestar y herramientas de autoayuda a los usuarios. El sistema incluirá una interfaz de chat principal (desplegable como un widget flotante) y un panel de administración interno.

**Tecnologías Clave Mencionadas:**
*   **OpenAI:** Para el motor de conversación, análisis de imágenes, transcripción de voz a texto
*   **Supabase:** Para la gestión de la base de datos (PostgreSQL) y la autenticación de usuarios.

Estoy trabajando con una conexión SSH con replit y las keys ya están almacenadas allá

## 2. Componentes Principales del Sistema

1.  **Interfaz de Chat para el Usuario (Widget Flotante):** La cara visible de MOMi para los usuarios finales.
2.  **Backend (Servidor de Aplicación):** El cerebro que procesa la lógica, interactúa con OpenAI y gestiona los datos.
3.  **Base de Datos (gestionada por Supabase):** Donde se almacenará toda la información persistente.
4.  **Panel de Administración:** Una interfaz para que los administradores gestionen el sistema.

## 3. Funcionalidades Detalladas

### 3.1. Autenticación y Gestión de Usuarios (Supabase Auth)

*   **Usuarios Invitados:**
    *   Permitir a los usuarios interactuar con MOMi sin necesidad de crear una cuenta.
    *   Generar y gestionar un identificador de sesión temporal para mantener la continuidad de la conversación del invitado.
*   **Usuarios Registrados (gestionado por Supabase):**
    *   Permitir a los usuarios crear una cuenta (ej. con email/contraseña o proveedores sociales que Supabase soporte).
    *   Permitir a los usuarios iniciar y cerrar sesión.
    *   Asociar el historial de chat y preferencias a la cuenta del usuario registrado.
    *   Storage every user chat history, interests, session, etc, 

### 3.2. Interfaz de Chat para el Usuario (Frontend)

Esta interfaz será el principal punto de interacción para los usuarios. Se desplegará principalmente como un widget flotante en sitios web externos.

*   **A. Experiencia de Chat Principal:**
    *   **Visualización de Conversación:** Mostrar el historial de mensajes entre el usuario y MOMi de forma clara (ej. burbujas de chat diferenciadas).
    *   **Entrada de Texto:** Campo para que el usuario escriba sus mensajes.
    *   **Botón de Envío:** Para enviar el mensaje escrito.
    *   **Actualizaciones en Tiempo Real:** Los nuevos mensajes (tanto del usuario como de MOMi) deben aparecer sin necesidad de recargar la página..
    *   **Scroll Automático:** El área de chat debe desplazarse automáticamente hacia el mensaje más reciente.
    *   **Descargo de Responsabilidad Legal:** Un mensaje fijo y visible que indique que MOMi no ofrece consejo médico profesional y que es una IA.
    *   El chat tiene la capacidad de recordar todo lo que el usuario ha dicho y tener contexto de las imagenes o chats anteriormente enviadas

*   **B. Funcionalidades Multimedia e Interactivas:**'
    *   El chat tiene la capacidad de enviar hipervinculos recomendado al usuario algo en especifico dependiendo de la conversacion, MOMIS tendrá la capacidad de saber cuando
    *   El chat tiene la capacidad de analizar imagenes y responder al usuario cualquier pregunta que tenga
    *   **Envío y Visualización de Imágenes:**
        *   Botón para permitir al usuario seleccionar un archivo de imagen desde su dispositivo.
        *   Previsualización de la imagen seleccionada antes de enviarla, con opción de eliminar/cancelar la selección.
        *   Visualización de las imágenes enviadas por el usuario o por MOMi dentro de las burbujas de chat.
    *   **Entrada de Voz (Speech-to-Text vía OpenAI):**
        *   Botón de micrófono para iniciar/detener la grabación de audio.
        *   Solicitud de permisos del navegador para acceder al micrófono.
        *   Retroalimentación visual al usuario durante la grabación (ej. ícono parpadeante).
        *   Envío del audio grabado al backend para su transcripción.
        *   El texto transcrito por OpenAI se debe insertar en el campo de entrada de texto del chat y enviarlo automaticamente como un mensaje
        *   Manejo de errores (ej. si no se otorgan permisos, si la transcripción falla).

*   **C. Experiencia de Usuario (UI/UX):**
    *   **Visualización de Errores:** Mostrar mensajes de error de forma clara pero no intrusiva si algo falla.
    *   **Diseño Empático:** El estilo visual y el tono deben ser acogedores y transmitir empatía.
    *   **Diseño Responsivo:** Asegurar que el widget se vea bien en diferentes tamaños de pantalla donde podría ser incrustado.


### 3.5. Panel de Administración (Frontend)

Una aplicación web separada (o una sección protegida de la app principal) para que los administradores gestionen MOMi.

*   **A. Autenticación Segura:** Solo usuarios con el rol 'admin' podrán acceder.

    **B. Panel de Analíticas Básicas:**
    *   Mostrar estadísticas simples: número de usuarios, número de mensajes por día, etc.

*   **C. Gestión de Usuarios y conversaciones:**
    *   Listar todos los usuarios (invitados y registrados).
    *   Ver detalles de un usuario, incluyendo su historial de chat.
    *   Buscar y filtrar sesiones de chat.
    *   Ver transcripciones completas de las conversaciones.
*   **D. Gestión de la Base de Conocimiento (RAG) y configuración del Sistema:**
    *   Subir nuevos documentos (ej. archivos de texto, PDFs).
    *   Ver, editar o eliminar documentos existentes.
    *   Botón para re-indexar documentos o actualizar embeddings.
    *   Modificar prompt del sistema que guía el comportamiento de MOMi (ej. su personalidad, instrucciones base).
    *   Activar/desactivar ciertas funcionalidades.


### 3.7. Requisitos No Funcionales Clave

*   **Tono y Personalidad de MOMi:** Las respuestas de MOMi deben ser consistentemente empáticas, comprensivas y de apoyo. Esto se configurará principalmente a través de los "system prompts" enviados a OpenAI.
*   **Privacidad y Seguridad:** Los datos del usuario deben manejarse de forma segura y confidencial.
*   **Escalabilidad:** La arquitectura debe ser capaz de manejar un crecimiento futuro en usuarios y tráfico.
*   **Mantenibilidad:** El código debe estar bien organizado, ser legible y fácil de modificar o extender.
*   **Manejo de Errores Robusto:** Tanto el frontend como el backend deben manejar los errores de forma elegante e informar al usuario cuando sea apropiado.
*   **Accesibilidad (a11y):** La interfaz de chat debe esforzarse por cumplir con las pautas de accesibilidad web (ej. WCAG) para ser usable por la mayor cantidad de personas posible.

Take inspiration from this color palette

| Color                 | Código HEX | Uso sugerido                                  |
| --------------------- | ---------- | --------------------------------------------- |
| **Púrpura Principal** | `#913D9A`  | Botones, títulos, elementos destacados        |
| **Púrpura Claro**     | `#EBC7F2`  | Fondos suaves, secciones, contornos           |
| **Blanco Suave**      | `#FFF8FC`  | Fondo principal o zonas de lectura            |
| **Gris Oscuro**       | `#333333`  | Texto principal                               |
| **Gris Claro**        | `#AAAAAA`  | Texto secundario, descripciones o bordes      |
| **Negro Opaco**       | `#1F1F1F`  | Contrastes y encabezados en secciones oscuras |
| **Magenta Vibrante**  | `#C542C1`  | Llamadas a la acción, íconos interactivos     |

</rewritten_file> 