import WidgetKit
import SwiftUI
import LiveActivityCountdownView

@main
struct RestTimerWidgetBundle: WidgetBundle {
  var body: some Widget {
    LiveActivityCountdownWidgetExtensionLiveActivity()
  }
}
