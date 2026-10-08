package com.petcore.app.oficial;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin propio de la app: debe registrarse ANTES de super.onCreate()
        registerPlugin(FondoVentanaPlugin.class);
        registerPlugin(GuardarArchivoPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
