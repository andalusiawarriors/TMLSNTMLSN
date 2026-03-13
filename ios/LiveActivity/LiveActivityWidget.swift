import ActivityKit
import SwiftUI
import WidgetKit

struct LiveActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var title: String
    var subtitle: String?
    /// Epoch ms for a countdown timer (set by progressBar.date in JS)
    var timerEndDateInMilliseconds: Double?
    /// Epoch ms for a count-up elapsed timer (set by progressBar.elapsedTimer.startDate in JS)
    var elapsedTimerStartDateInMilliseconds: Double?
    /// 0–1 static progress (set by progressBar.progress in JS)
    var progress: Double?
    var imageName: String?
    var dynamicIslandImageName: String?
  }

  var name: String
  var backgroundColor: String?
  var titleColor: String?
  var subtitleColor: String?
  var progressViewTint: String?
  var progressViewLabelColor: String?
  var deepLinkUrl: String?
  var timerType: DynamicIslandTimerType?
  var padding: Int?
  var paddingDetails: PaddingDetails?
  var imagePosition: String?
  var imageWidth: Int?
  var imageHeight: Int?
  var imageWidthPercent: Double?
  var imageHeightPercent: Double?
  var imageAlign: String?
  var contentFit: String?

  enum DynamicIslandTimerType: String, Codable {
    case circular
    case digital
  }

  struct PaddingDetails: Codable, Hashable {
    var top: Int?
    var bottom: Int?
    var left: Int?
    var right: Int?
    var vertical: Int?
    var horizontal: Int?
  }
}

struct LiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: LiveActivityAttributes.self) { context in
      LiveActivityView(contentState: context.state, attributes: context.attributes)
        .activityBackgroundTint(
          context.attributes.backgroundColor.map { Color(hex: $0) }
        )
        .activitySystemActionForegroundColor(Color.black)
        .applyWidgetURL(from: context.attributes.deepLinkUrl)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading, priority: 1) {
          dynamicIslandExpandedLeading(title: context.state.title, subtitle: context.state.subtitle)
            .dynamicIsland(verticalPlacement: .belowIfTooWide)
            .padding(.leading, 5)
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
        DynamicIslandExpandedRegion(.trailing) {
          if let imageName = context.state.imageName {
            dynamicIslandExpandedTrailing(imageName: imageName)
              .padding(.trailing, 5)
              .applyWidgetURL(from: context.attributes.deepLinkUrl)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          if let date = context.state.timerEndDateInMilliseconds {
            dynamicIslandExpandedCountdownBottom(
              endDate: date, progressViewTint: context.attributes.progressViewTint
            )
            .padding(.horizontal, 5)
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
          } else if let startDate = context.state.elapsedTimerStartDateInMilliseconds {
            dynamicIslandExpandedElapsedBottom(startDate: startDate)
              .padding(.horizontal, 5)
              .applyWidgetURL(from: context.attributes.deepLinkUrl)
          }
        }
      } compactLeading: {
        if let dynamicIslandImageName = context.state.dynamicIslandImageName {
          resizableImage(imageName: dynamicIslandImageName)
            .frame(maxWidth: 23, maxHeight: 23)
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
        } else {
          // Workout name — bold 14, truncated
          Text(context.state.title)
            .font(.system(size: 14, weight: .bold))
            .foregroundStyle(.white)
            .lineLimit(1)
            .truncationMode(.tail)
            .frame(maxWidth: 80)
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
      } compactTrailing: {
        if let date = context.state.timerEndDateInMilliseconds {
          // Countdown timer (rest timer)
          compactTimer(
            endDate: date,
            timerType: context.attributes.timerType ?? .circular,
            progressViewTint: context.attributes.progressViewTint
          ).applyWidgetURL(from: context.attributes.deepLinkUrl)
        } else if let startDate = context.state.elapsedTimerStartDateInMilliseconds {
          // Elapsed (count-up) timer — monospaced bold
          elapsedTimer(startDate: startDate)
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
        } else if let subtitle = context.state.subtitle {
          // Fallback: set progress (e.g. "3/5 sets")
          Text(subtitle)
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(Color(white: 0.78))
            .lineLimit(1)
            .frame(maxWidth: 60)
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
      } minimal: {
        if let date = context.state.timerEndDateInMilliseconds {
          compactTimer(
            endDate: date,
            timerType: context.attributes.timerType ?? .circular,
            progressViewTint: context.attributes.progressViewTint
          ).applyWidgetURL(from: context.attributes.deepLinkUrl)
        } else if let startDate = context.state.elapsedTimerStartDateInMilliseconds {
          // Minimal: just the timer, monospaced
          elapsedTimer(startDate: startDate)
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
        } else {
          Text(context.state.title)
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(.white)
            .lineLimit(1)
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
      }
    }
  }

  // MARK: - Compact trailing helpers

  @ViewBuilder
  private func compactTimer(
    endDate: Double,
    timerType: LiveActivityAttributes.DynamicIslandTimerType,
    progressViewTint: String?
  ) -> some View {
    if timerType == .digital {
      Text(timerInterval: Date.toTimerInterval(miliseconds: endDate))
        .font(.system(size: 16, weight: .bold))
        .minimumScaleFactor(0.8)
        .monospacedDigit()
        .frame(maxWidth: 60)
        .multilineTextAlignment(.trailing)
    } else {
      circularTimer(endDate: endDate)
        .tint(progressViewTint.map { Color(hex: $0) })
    }
  }

  /// Count-up elapsed timer for Dynamic Island compact trailing / minimal (active workout).
  private func elapsedTimer(startDate: Double) -> some View {
    let start = Date(timeIntervalSince1970: startDate / 1000)
    return Text(
      timerInterval: start...Date.distantFuture,
      countsDown: false
    )
    .font(.system(size: 16, weight: .bold))
    .minimumScaleFactor(0.7)
    .monospacedDigit()
    .frame(maxWidth: 60)
    .multilineTextAlignment(.trailing)
  }

  // MARK: - Expanded DI region helpers

  /// Top row: workout name + green active dot.
  private func dynamicIslandExpandedLeading(title: String, subtitle: String?) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      Spacer()
      // Row 1: workout name + green dot
      HStack(spacing: 5) {
        Text(title)
          .font(.system(size: 14, weight: .bold))
          .foregroundStyle(.white)
          .lineLimit(1)
        Circle()
          .fill(Color(red: 0.2, green: 0.78, blue: 0.35))
          .frame(width: 6, height: 6)
      }
      // Row 2: exercise name + set progress
      if let subtitle {
        Text(subtitle)
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(.white)
          .lineLimit(1)
      }
      Spacer()
    }
  }

  private func dynamicIslandExpandedTrailing(imageName: String) -> some View {
    VStack {
      Spacer()
      resizableImage(imageName: imageName)
      Spacer()
    }
  }

  /// Row 3: rest countdown timer — large monospaced.
  private func dynamicIslandExpandedCountdownBottom(endDate: Double, progressViewTint: String?) -> some View {
    HStack {
      Text("Rest")
        .font(.system(size: 10, weight: .medium))
        .foregroundStyle(Color(white: 0.78))
      Spacer()
      Text(timerInterval: Date.toTimerInterval(miliseconds: endDate))
        .font(.system(size: 16, weight: .bold))
        .monospacedDigit()
        .foregroundStyle(.white)
        .multilineTextAlignment(.trailing)
    }
    .padding(.top, 6)
  }

  /// Row 3: elapsed time — large monospaced.
  private func dynamicIslandExpandedElapsedBottom(startDate: Double) -> some View {
    let start = Date(timeIntervalSince1970: startDate / 1000)
    return HStack {
      Text("Elapsed")
        .font(.system(size: 10, weight: .medium))
        .foregroundStyle(Color(white: 0.78))
      Spacer()
      Text(
        timerInterval: start...Date.distantFuture,
        countsDown: false
      )
      .font(.system(size: 16, weight: .bold))
      .monospacedDigit()
      .foregroundStyle(.white)
      .multilineTextAlignment(.trailing)
    }
    .padding(.top, 6)
  }

  private func circularTimer(endDate: Double) -> some View {
    ProgressView(
      timerInterval: Date.toTimerInterval(miliseconds: endDate),
      countsDown: false,
      label: { EmptyView() },
      currentValueLabel: {
        EmptyView()
      }
    )
    .progressViewStyle(.circular)
  }
}
