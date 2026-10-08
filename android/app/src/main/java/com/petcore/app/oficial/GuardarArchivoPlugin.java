package com.petcore.app.oficial;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;

/* Guarda un archivo (PDF) en la carpeta pública Descargas/PetCore SIN pedir permisos.

   Capacitor Filesystem escribe con rutas directas (/storage/emulated/0/Documents/...), y desde Android 11 (almacenamiento
   por ámbitos) eso falla con "EACCES (Permission denied)": solo se pueden crear archivos en carpetas públicas a través de
   MediaStore. En Android 10+ el archivo lo crea el sistema (colección Descargas) y queda visible en la app Archivos /
   Descargas. En Android 9 o anterior (API < 29) no se usa: ahí Filesystem sí funciona con el permiso de almacenamiento. */
@CapacitorPlugin(name = "GuardarArchivo")
public class GuardarArchivoPlugin extends Plugin {

    @PluginMethod
    public void guardarEnDescargas(final PluginCall call) {
        final String nombre = call.getString("nombre");
        final String datos = call.getString("datos");
        final String tipo = call.getString("tipo", "application/pdf");
        if (nombre == null || datos == null) {
            call.reject("Faltan 'nombre' o 'datos'");
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.reject("SDK_ANTIGUO");   // el JS cae a Filesystem
            return;
        }

        try {
            byte[] bytes = Base64.decode(datos, Base64.DEFAULT);
            ContentResolver resolver = getContext().getContentResolver();

            ContentValues valores = new ContentValues();
            valores.put(MediaStore.MediaColumns.DISPLAY_NAME, nombre);
            valores.put(MediaStore.MediaColumns.MIME_TYPE, tipo);
            valores.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/PetCore");
            valores.put(MediaStore.MediaColumns.IS_PENDING, 1);

            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, valores);
            if (uri == null) {
                call.reject("No se pudo crear el archivo en Descargas");
                return;
            }

            try (OutputStream salida = resolver.openOutputStream(uri)) {
                if (salida == null) {
                    call.reject("No se pudo abrir el archivo para escribir");
                    return;
                }
                salida.write(bytes);
            }

            valores.clear();
            valores.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(uri, valores, null, null);

            JSObject respuesta = new JSObject();
            respuesta.put("uri", uri.toString());
            call.resolve(respuesta);
        } catch (Exception e) {
            call.reject("No se pudo guardar el archivo: " + e.getMessage(), e);
        }
    }
}
