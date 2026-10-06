package com.petcore.app.oficial;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.view.Window;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/* Pinta el fondo de la VENTANA nativa (lo que hay detrás del WebView).

   Capacitor 8 (SystemBars) deja el WebView debajo de la barra de estado reservando ese espacio con padding en la
   ventana. En Android viejo (probado en un Samsung J7 Prime, Android 8.1) el color de la barra que se manda con
   StatusBar.setBackgroundColor() NO se dibuja en esa franja -- se ve el fondo de la ventana (blanco), con los
   íconos claros encima, ilegibles. Pintando el fondo de la ventana con el color del tema, la franja queda del
   color del header (o del fondo en login) y la barra se ve como parte de la pantalla. */
@CapacitorPlugin(name = "FondoVentana")
public class FondoVentanaPlugin extends Plugin {

    @PluginMethod
    public void setColor(final PluginCall call) {
        final String color = call.getString("color");
        if (color == null) {
            call.reject("Color must be provided");
            return;
        }

        final int parsed;
        try {
            parsed = Color.parseColor(color);
        } catch (IllegalArgumentException ex) {
            call.reject("Invalid color provided. Must be a hex string (ex: #ff0000)");
            return;
        }

        getBridge().executeOnMainThread(() -> {
            Window ventana = getActivity().getWindow();
            ventana.setBackgroundDrawable(new ColorDrawable(parsed));
            // Cambiar el fondo de la ventana no siempre repinta la franja si el DecorView no se invalida
            // (pasaba al navegar entre páginas): se fija también en el DecorView y se fuerza el repintado.
            ventana.getDecorView().setBackgroundColor(parsed);
            ventana.getDecorView().invalidate();
            call.resolve();
        });
    }

    /* Fuerza a Android a recalcular los insets de la ventana. En Android 8.1 la decisión de SystemBars (WebView a
       pantalla completa vs. WebView con una franja reservada arriba) se toma antes de saber que la página declara
       viewport-fit=cover y no se corrige sola: queda la franja blanca bajo la barra de estado hasta que algo más
       provoque un nuevo cálculo. Se invoca desde JS cuando la página terminó de cargar. */
    @PluginMethod
    public void reaplicarInsets(final PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            getActivity().getWindow().getDecorView().requestApplyInsets();
            getBridge().getWebView().requestApplyInsets();
            call.resolve();
        });
    }
}
